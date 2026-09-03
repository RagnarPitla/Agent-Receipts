// Environment-wide survey of Copilot Studio agent components.
//
// The point of this script is one number. In a real environment, componenttype 9
// holds hundreds of rows and only a small fraction of them are skills. A check
// that counts componenttype and calls the answer "skills" is not slightly wrong,
// it is wrong by an order of magnitude, and it is wrong in the direction that
// makes a project look finished.
//
// Read-only. GET requests only. Nothing here writes to an environment.
//
//   MCS_TOKEN=$(cat /tmp/dvtok.txt) node scripts/live-survey.mjs \
//     --env-url https://example.crm.dynamics.com \
//     --control-bot <guid> --control-skills 6
//
// The control arguments are not optional decoration. `kind` is parsed out of a
// YAML blob with a regex, and if that regex ever stops matching, every row falls
// into one bucket and the script reports a beautifully clean distribution that
// describes nothing. Naming a bot whose skill count is already known, and
// failing when the survey disagrees with it, is the only thing separating this
// from a script that cannot tell you it has broken.

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { token, kindOf } from '../src/probes/dataverse.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = undefined) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};

const envUrl = (flag('env-url') ?? process.env.MCS_ENV_URL ?? '').replace(/\/$/, '');
const controlBot = flag('control-bot');
const controlSkills = Number(flag('control-skills'));
const out = flag('out', 'evidence/live-environment-survey.txt');

if (!envUrl || !controlBot || !Number.isFinite(controlSkills)) {
  console.error('usage: live-survey.mjs --env-url <url> --control-bot <guid> --control-skills <n>');
  console.error('  --control-bot     an agent whose skill count is independently known');
  console.error('  --control-skills  that known count, so a broken parse fails instead of reporting');
  process.exit(2);
}

const raw = argv.includes('--raw');
const shortHash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const redact = (s) => {
  let t = String(s)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, '******')
    .replace(/eyJ[A-Za-z0-9._-]{40,}/g, '[redacted-jwt]');
  if (raw) return t;
  t = t.replace(/https:\/\/([a-z0-9-]+)\.(crm\d*\.dynamics\.com)/gi,
    (_m, host, rest) => `https://env-${shortHash(host)}.${rest}`);
  t = t.replace(GUID, (g) => `id-${shortHash(g)}`);
  return t;
};

const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
const fails = [];
const tok = token(envUrl);

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tok}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Prefer: 'odata.maxpagesize=500',
    },
  });
  if (!res.ok) throw new Error(`Dataverse ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/**
 * Follows @odata.nextLink to exhaustion.
 *
 * Do not add $top to this. $top caps the result AND suppresses @odata.nextLink,
 * so the response looks like a complete result set that happens to be smaller.
 * There is no error and no truncation warning. C3 below measures that.
 */
async function getAll(path) {
  let url = `${envUrl}/api/data/v9.2/${path}`;
  const rows = [];
  let pages = 0;
  while (url) {
    const page = await getJson(url);
    rows.push(...(page.value ?? []));
    url = page['@odata.nextLink'] ?? null;
    pages += 1;
    if (pages > 200) throw new Error('paging did not terminate after 200 pages');
  }
  return { rows, pages };
}

const started = new Date().toISOString();
say('AGENT RECEIPTS - LIVE ENVIRONMENT SURVEY');
say('');
say(`environment : ${redact(envUrl)}`);
say(`started     : ${started}`);
say('mode        : read-only, GET requests only');
say('');

let rows = [];
let pages = 0;
let botCount = 0;

try {
  const bots = await getAll('bots?$select=botid,name');
  botCount = bots.rows.length;
  const comps = await getAll('botcomponents?$select=_parentbotid_value,componenttype,data,name&$filter=componenttype eq 9');
  rows = comps.rows;
  pages = comps.pages;
} catch (e) {
  say(`FAILED: ${redact(e.message)}`);
  fails.push(`the environment did not answer: ${redact(e.message)}`);
}

say('## 1. what componenttype 9 actually contains');
say('');
say(`  ${botCount} agent(s) in the environment`);
say(`  ${rows.length} row(s) of componenttype 9, read over ${pages} page(s)`);
say('');

const byKind = new Map();
for (const r of rows) {
  const k = kindOf(r);
  byKind.set(k, (byKind.get(k) ?? 0) + 1);
}
const sorted = [...byKind.entries()].sort((a, b) => b[1] - a[1]);
const skillTotal = byKind.get('InlineAgentSkill') ?? 0;

for (const [k, n] of sorted) {
  const pct = rows.length ? ((n / rows.length) * 100).toFixed(1) : '0.0';
  say(`    ${String(n).padStart(5)}  ${String(pct).padStart(5)}%  ${k}`);
}
say('');

if (rows.length) {
  say(`  Counting componenttype alone reports ${rows.length} skills.`);
  say(`  Counting kind reports ${skillTotal}.`);
  const factor = skillTotal ? (rows.length / skillTotal).toFixed(0) : 'infinitely many';
  say(`  The first number is wrong by a factor of ${factor}, in the flattering direction.`);
  say('');
}

const botsWithSkills = new Set();
for (const r of rows) {
  if (kindOf(r) === 'InlineAgentSkill') botsWithSkills.add(r._parentbotid_value);
}
say(`  ${botsWithSkills.size} of ${botCount} agent(s) hold at least one skill.`);
say('');

say('## 2. the controls');
say('');

// C1. A parse that has stopped working returns one bucket for everything. Any
// real environment has several kinds under componenttype 9.
const c1 = byKind.size >= 2;
say(`  C1 the kind parse discriminates            ${c1 ? 'PASS' : 'FAIL'}  (${byKind.size} distinct kinds)`);
if (!c1) fails.push(`only ${byKind.size} kind(s) parsed out of ${rows.length} rows, which means the parse is broken, not that the environment is uniform`);

// C2. The load-bearing one. This count was established independently by
// scripts/live-run.mjs against the same agent. If the survey disagrees with it,
// the survey is wrong and every number above it is decoration.
const controlRows = rows.filter((r) => String(r._parentbotid_value).toLowerCase() === String(controlBot).toLowerCase());
const controlActual = controlRows.filter((r) => kindOf(r) === 'InlineAgentSkill').length;
const c2 = controlActual === controlSkills;
say(`  C2 the known agent still has ${controlSkills} skill(s)     ${c2 ? 'PASS' : 'FAIL'}  (survey counted ${controlActual})`);
if (!c2) fails.push(`the control agent should hold ${controlSkills} skill(s) and the survey counted ${controlActual}`);

// C3. Demonstrates the truncation this script exists to avoid, rather than
// asserting in a comment that it was avoided.
let c3 = true;
try {
  const capped = await getJson(`${envUrl}/api/data/v9.2/botcomponents?$select=componenttype&$filter=componenttype eq 9&$top=200`);
  const cappedRows = (capped.value ?? []).length;
  const suppressed = !capped['@odata.nextLink'];
  c3 = cappedRows < rows.length && suppressed;
  say(`  C3 $top truncates and hides that it did     ${c3 ? 'PASS' : 'FAIL'}  ($top=200 returned ${cappedRows} of ${rows.length}, nextLink ${suppressed ? 'absent' : 'present'})`);
  if (!c3) fails.push('the $top arm did not reproduce the truncation it is meant to demonstrate');
} catch (e) {
  c3 = false;
  fails.push(`the $top control arm could not run: ${redact(e.message)}`);
  say(`  C3 FAILED: ${redact(e.message)}`);
}

say('');
say('## verdict');
say('');
if (fails.length === 0) {
  say('  Every control held. The distribution above is what this environment');
  say('  actually contains, not what a broken parse would print.');
  say('');
  say('SURVEY OK');
} else {
  say('  This survey is not trustworthy:');
  for (const f of fails) say(`    - ${f}`);
  say('');
  say('SURVEY FAIL');
}
say('');
say(`finished    : ${new Date().toISOString()}`);

const body = lines.join('\n') + '\n';
const header = fails.length === 0 ? 'SURVEY OK\n\n' : 'SURVEY FAIL\n\n';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, header + body, 'utf8');
console.log(`\nwrote ${out}`);
process.exit(fails.length === 0 ? 0 : 1);
