// Copilot Studio probes.
//
// Each probe prints one machine-readable verdict line beginning PROOF OK or
// PROOF FAIL, then human detail. Gates match on PROOF OK, so a probe that
// crashes fails its gate rather than passing it by silence.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { loadComponents, skillsFrom, kindOf, harnessOf, ProbeError } from './dataverse.mjs';

const OK = 'PROOF OK';
const FAIL = 'PROOF FAIL';

function verdict(ok, headline, detail = []) {
  console.log(`${ok ? OK : FAIL} ${headline}`);
  for (const d of detail) console.log(`  ${d}`);
  return ok ? 0 : 1;
}

function norm(s) {
  return (s ?? '').replace(/\r\n/g, '\n').replace(/\s+$/gm, '').replace(/\s+$/, '').trim();
}

function digest(s) {
  return createHash('sha256').update(norm(s)).digest('hex').slice(0, 12);
}

/** Local skills on disk: any directory containing a SKILL.md, plus bare SKILL.md. */
export function localSkills(path) {
  if (!existsSync(path)) throw new ProbeError(`no such path: ${path}`);
  const out = [];
  if (statSync(path).isFile()) {
    out.push({ name: basename(join(path, '..')), file: path, content: readFileSync(path, 'utf8') });
    return out;
  }
  const direct = join(path, 'SKILL.md');
  if (existsSync(direct)) {
    out.push({ name: basename(path), file: direct, content: readFileSync(direct, 'utf8') });
    return out;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const f = join(path, entry.name, 'SKILL.md');
    if (existsSync(f)) out.push({ name: entry.name, file: f, content: readFileSync(f, 'utf8') });
  }
  return out;
}

// ---------------------------------------------------------------- deployment

/**
 * The gate that catches the most expensive trap on this platform.
 * `pac copilot push` reports success and silently creates nothing for a new
 * skill. A push that "worked" therefore proves nothing until the component is
 * read back off the server.
 */
export async function skillDeployed(args) {
  const { components } = await loadComponents(args);
  const deployed = skillsFrom(components);
  const want = args.name ? [args.name] : localSkills(args.path).map((s) => s.name);
  const names = deployed.map((d) => d.name);

  const missing = want.filter((w) => !names.includes(w));
  return verdict(
    missing.length === 0,
    missing.length === 0
      ? `${want.length} of ${want.length} skills are present on the agent`
      : `${missing.length} skill(s) named in the ledger are not on the agent`,
    [
      `expected: ${want.join(', ') || '(none)'}`,
      `on agent: ${names.join(', ') || '(none)'}`,
      ...missing.map((m) => `MISSING: ${m}  <- push reported success; the component does not exist`),
    ]
  );
}

/** Deployed bytes equal local bytes. Catches a stale or truncated deploy. */
export async function skillMatches(args) {
  const { components } = await loadComponents(args);
  const deployed = new Map(skillsFrom(components).map((d) => [d.name, d.content]));
  const local = localSkills(args.path);
  if (local.length === 0) return verdict(false, `no SKILL.md found under ${args.path}`);

  const rows = [];
  let bad = 0;
  for (const s of local) {
    const server = deployed.get(s.name);
    if (server === undefined) {
      bad++;
      rows.push(`ABSENT   ${s.name}  local=${digest(s.content)} server=(not deployed)`);
      continue;
    }
    const same = norm(server) === norm(s.content);
    if (!same) bad++;
    rows.push(`${same ? 'MATCH  ' : 'DIVERGED'} ${s.name}  local=${digest(s.content)} server=${digest(server)}`);
  }
  return verdict(bad === 0, bad === 0
    ? `${local.length} skill(s) on the agent are byte-identical to source`
    : `${bad} of ${local.length} skill(s) differ from source`, rows);
}

/** Nothing deployed that is not in source control, and nothing in source missing. */
export async function noOrphanSkills(args) {
  const { components } = await loadComponents(args);
  const server = skillsFrom(components).map((d) => d.name).sort();
  const local = localSkills(args.path).map((s) => s.name).sort();
  const extra = server.filter((n) => !local.includes(n));
  const missing = local.filter((n) => !server.includes(n));
  return verdict(extra.length === 0 && missing.length === 0,
    extra.length === 0 && missing.length === 0
      ? `agent and source agree on ${local.length} skill(s)`
      : `agent and source disagree`,
    [
      `source: ${local.join(', ') || '(none)'}`,
      `agent : ${server.join(', ') || '(none)'}`,
      ...extra.map((n) => `ON AGENT ONLY: ${n}  <- not in source control, nobody can review it`),
      ...missing.map((n) => `IN SOURCE ONLY: ${n}  <- never reached the agent`),
    ]);
}

export async function harness(args) {
  const { bot } = await loadComponents(args);
  const found = harnessOf(bot);
  const want = args.expect ?? 'github-copilot';
  return verdict(found === want, `harness is "${found}", expected "${want}"`, [
    'Detected from the recognizer name in the bot configuration.',
    'CLICopilotRecognizer -> github-copilot (the harness that supports skills).',
    'GenerativeAIRecognizer -> standard.',
    'Neither name is documented by Microsoft, so "unknown" fails rather than guesses.',
  ]);
}

export async function componentCount(args) {
  const { components } = await loadComponents(args);
  const byKind = {};
  for (const c of components) byKind[kindOf(c)] = (byKind[kindOf(c)] ?? 0) + 1;
  const n = byKind[args.kind] ?? 0;
  const min = Number(args.min ?? 1);
  return verdict(n >= min, `${n} component(s) of kind ${args.kind}, needed at least ${min}`,
    Object.entries(byKind).sort().map(([k, v]) => `${String(v).padStart(4)}  ${k}`));
}

export async function instructionsContain(args) {
  const { bot } = await loadComponents(args);
  const cfg = typeof bot.configuration === 'string' ? bot.configuration : JSON.stringify(bot.configuration ?? {});
  const needle = args.text ?? '';
  if (!needle) throw new ProbeError('instructions-contain needs --text');
  const found = cfg.toLowerCase().includes(needle.toLowerCase());
  return verdict(found, found
    ? `agent instructions contain the required clause`
    : `agent instructions do not contain the required clause`,
    [`looked for: ${needle}`]);
}

// ------------------------------------------------------------------- quality

const RUBRIC = [
  ['when to invoke', /\b(when to (use|invoke)|use this (skill )?when|invoke (this|when)|trigger)\b/i],
  ['required inputs', /\b(inputs?|required inputs?|you will need|parameters?|arguments?)\b/i],
  ['what to ask when inputs are missing', /\b(if (the user |you )?(has not|hasn.t|do(es)? not|don.t|cannot)|missing|ask the user|if unknown|if not (provided|supplied|given))\b/i],
  ['the steps', /^\s*(\d+\.|step\s*\d|-\s)/im],
  ['confirmation before side effects', /\b(confirm|approval|ask before|do not (write|post|send|submit|publish)|read-only|never .* without)\b/i],
  ['expected output', /\b(output|returns?|the result|produce|deliverable|respond with)\b/i],
  ['what to do on failure', /\b(if (it |this )?fails?|on (failure|error)|error handling|cannot|unable to|fall back|escalate)\b/i],
];

/**
 * Offline. Touches no environment. This is the rubric the platform docs ask
 * for, made checkable, because "write a good skill" is not a gate.
 */
export function skillQuality(args) {
  const skills = localSkills(args.path);
  if (skills.length === 0) return verdict(false, `no SKILL.md found under ${args.path}`);
  const min = Number(args.min ?? RUBRIC.length);
  const rows = [];
  let failing = 0;

  for (const s of skills) {
    const body = s.content;
    const hits = RUBRIC.filter(([, re]) => re.test(body)).map(([label]) => label);
    const missing = RUBRIC.filter(([, re]) => !re.test(body)).map(([label]) => label);
    const hasFrontMatter = /^---\n[\s\S]*?\n---/.test(body);
    const named = /^\s*name:\s*\S+/m.test(body);
    const described = /^\s*description:\s*\S+/m.test(body);
    const ok = hits.length >= min && hasFrontMatter && named && described;
    if (!ok) failing++;
    rows.push(`${ok ? 'PASS' : 'FAIL'}  ${s.name}  ${hits.length}/${RUBRIC.length} rubric` +
      `${hasFrontMatter ? '' : ', no front matter'}${named ? '' : ', no name:'}${described ? '' : ', no description:'}`);
    for (const m of missing) rows.push(`        missing: ${m}`);
  }
  return verdict(failing === 0,
    failing === 0 ? `${skills.length} skill(s) meet the rubric` : `${failing} of ${skills.length} skill(s) fall short`,
    rows);
}

/** Every skill has at least one evaluation case naming it. Offline. */
export function evalCoverage(args) {
  const skills = localSkills(args.path);
  const evalDir = args.evals;
  if (!existsSync(evalDir)) return verdict(false, `no evaluation directory at ${evalDir}`);
  const corpus = readdirSync(evalDir, { recursive: true })
    .filter((f) => /\.(ya?ml|csv|md|json)$/i.test(String(f)))
    .map((f) => {
      try { return readFileSync(join(evalDir, String(f)), 'utf8'); } catch { return ''; }
    })
    .join('\n');
  const uncovered = skills.filter((s) => !corpus.includes(s.name));
  return verdict(uncovered.length === 0,
    uncovered.length === 0
      ? `all ${skills.length} skill(s) appear in at least one evaluation case`
      : `${uncovered.length} skill(s) have no evaluation case`,
    uncovered.map((s) => `UNCOVERED: ${s.name}  <- ships with nothing measuring it`));
}

export const PROBES = {
  'skill-deployed': skillDeployed,
  'skill-matches': skillMatches,
  'no-orphan-skills': noOrphanSkills,
  harness,
  'component-count': componentCount,
  'instructions-contain': instructionsContain,
  'skill-quality': async (a) => skillQuality(a),
  'eval-coverage': async (a) => evalCoverage(a),
};
