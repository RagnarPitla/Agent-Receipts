#!/usr/bin/env node
// Run the probes against a live Copilot Studio environment and write the transcript
// that gate E1 reads.
//
// This script decides whether the run counts, not the person running it. It writes
// "PROOF OK" on the first line only when all four conditions below hold, and
// "PROOF FAIL" with the reason otherwise.
//
//   1. the environment answered WhoAmI, so it is live and reachable
//   2. every probe returned a definite verdict, none threw
//   3. an agent that should pass, passed
//   4. an agent that should fail, failed
//
// Condition 4 is the one that matters. A transcript where everything is green is
// also what a probe that cannot see anything would produce. Requiring one real
// failure against the same live data proves the probe discriminates here, not
// just that it ran here.
//
// Read-only. It issues GET requests and nothing else.
//
//   MCS_ENV_URL=https://yourorg.crm.dynamics.com \
//   MCS_TOKEN=$(az account get-access-token --resource $MCS_ENV_URL --query accessToken -o tsv) \
//   node scripts/live-run.mjs --pass-bot <guid> --fail-bot <guid> [--out evidence/live-tenant-run.txt]

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { PROBES } from '../src/probes/index.mjs';
import { token } from '../src/probes/dataverse.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = undefined) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};

const envUrl = (flag('env-url') ?? process.env.MCS_ENV_URL ?? '').replace(/\/$/, '');
const passBot = flag('pass-bot') ?? process.env.MCS_PASS_BOT;
const failBot = flag('fail-bot') ?? process.env.MCS_FAIL_BOT;
const out = flag('out', 'evidence/live-tenant-run.txt');

if (!envUrl || !passBot || !failBot) {
  console.error('usage: live-run.mjs --env-url <url> --pass-bot <guid> --fail-bot <guid>');
  console.error('  --pass-bot  an agent that genuinely has skills deployed');
  console.error('  --fail-bot  an agent that genuinely does not, the discrimination control');
  process.exit(2);
}

const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
const fails = [];

// This transcript gets committed, and in a public repository it would otherwise
// publish the hostname of someone's environment along with their tenant, user and
// agent identifiers. None of those are credentials, but none of them are needed
// either: the gate asks whether a live environment answered and whether the probes
// discriminated against it, and a stable digest answers both without naming the
// tenant. Pass --raw when you want the unredacted transcript for your own records.
const raw = argv.includes('--raw');
const shortHash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

// Never let a bearer token reach the transcript, redacted or not.
const redact = (s) => {
  let t = String(s)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._-]{40,}/g, '[redacted-jwt]');
  if (raw) return t;
  t = t.replace(/https:\/\/([a-z0-9-]+)\.(crm\d*\.dynamics\.com)/gi,
    (_m, host, rest) => `https://env-${shortHash(host)}.${rest}`);
  t = t.replace(GUID, (g) => `id-${shortHash(g)}`);
  return t;
};

const started = new Date().toISOString();

say('AGENT RECEIPTS - LIVE ENVIRONMENT RUN');
say('');
say(`environment : ${redact(envUrl)}`);
say(`started     : ${started}`);
say('mode        : read-only, GET requests only');
say('');

// 1. Prove the environment is live before believing anything a probe says about it.
say('## 1. the environment is live');
say('');
try {
  const tok = token(envUrl);
  const r = await fetch(`${envUrl}/api/data/v9.2/WhoAmI`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`WhoAmI returned HTTP ${r.status}`);
  const whoami = await r.json();
  say('  WhoAmI HTTP 200');
  say(`  OrganizationId ${redact(whoami.OrganizationId)}`);
  say(`  UserId         ${redact(whoami.UserId)}`);
  say('');
  say('  A recorded run against an environment that never answered is the thing');
  say('  this gate exists to refuse, so the check happens before the probes.');
} catch (e) {
  fails.push(`the environment did not answer WhoAmI: ${redact(e.message)}`);
  say(`  FAILED: ${redact(e.message)}`);
}
say('');

// A probe prints its own verdict and returns a process exit code: 0 passed,
// 1 failed. It does not return an object, and 0 is falsy, so anything that
// tests the return value for truthiness reads every pass as a failure.
// Capture the probe's stdout verbatim rather than paraphrasing it, so the
// transcript is the probe's own words and not this script's summary of them.
async function run(label, probe, args) {
  const fn = PROBES[probe];
  if (!fn) { fails.push(`no such probe: ${probe}`); return null; }

  const captured = [];
  const orig = console.log;
  console.log = (...a) => captured.push(a.join(' '));
  let code = null; let err = null;
  try {
    code = await fn({ envUrl, ...args });
  } catch (e) {
    err = e;
  } finally {
    console.log = orig;
  }

  say(`  ${label}`);
  for (const c of captured) say(`    ${redact(c)}`);

  if (err) {
    fails.push(`${label} threw instead of returning a verdict: ${redact(err.message)}`);
    say(`    ERROR ${redact(err.message)}`);
    return null;
  }
  if (code !== 0 && code !== 1) {
    fails.push(`${label} returned ${JSON.stringify(code)}, which is not a verdict`);
    return null;
  }
  return code === 0;
}

// 2. An agent that should pass.
say('## 2. an agent that should pass');
say('');
say(`  bot ${redact(passBot)}`);
say('');
const pos = await run('at least one skill is deployed', 'component-count',
  { botId: passBot, kind: 'InlineAgentSkill', min: 1 });
if (pos === null) fails.push('the positive case did not return a verdict');
else if (pos === false) fails.push('the agent chosen as the positive case did not pass');
say('');

// 3. The control. The same probe, the same environment, an agent that has no skills.
say('## 3. the discrimination control');
say('');
say(`  bot ${redact(failBot)}`);
say('');
say('  Same probe, same environment, same credentials, an agent that genuinely has');
say('  no skills. If this returns PASS the probe is not reading anything and every');
say('  green above is meaningless.');
say('');
const neg = await run('the same probe must say no here', 'component-count',
  { botId: failBot, kind: 'InlineAgentSkill', min: 1 });
if (neg === null) fails.push('the control did not return a verdict');
else if (neg === true) fails.push('the control passed, so the probe does not discriminate and this run proves nothing');
say('');

// 4. A second axis, so the run is not resting on one probe.
say('## 4. a second probe, on the same two agents');
say('');
const hPos = await run('harness of the positive agent', 'harness', { botId: passBot, expect: 'github-copilot' });
const hNeg = await run('harness of the control agent', 'harness', { botId: failBot, expect: 'github-copilot' });
if (hPos === null || hNeg === null) fails.push('the harness probe did not return a verdict on both agents');
say('');

say('## verdict');
say('');
if (fails.length === 0) {
  say('  Every probe returned a definite verdict against a live environment, the');
  say('  positive case passed, and the control failed on the same data. The probes');
  say('  discriminate here.');
  say('');
  say('PROOF OK');
} else {
  say('  This run does not count. Reasons:');
  for (const f of fails) say(`    - ${f}`);
  say('');
  say('PROOF FAIL');
}
say('');
say(`finished    : ${new Date().toISOString()}`);

mkdirSync(dirname(out), { recursive: true });
// The gate greps the first PROOF line, so put the verdict where it cannot be missed.
const verdictLine = fails.length === 0 ? 'PROOF OK' : 'PROOF FAIL';
writeFileSync(out, `${verdictLine}\n\n${lines.join('\n')}\n`);
console.log(`\nwrote ${out}`);
process.exit(fails.length === 0 ? 0 : 1);
