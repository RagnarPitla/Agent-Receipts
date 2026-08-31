#!/usr/bin/env node
// Deterministic tests. No network, no environment, no credentials.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLedgerText, LedgerError, STATE, summarise } from '../src/ledger.mjs';
import { lint } from '../src/lint.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'bin', 'receipts.mjs');
const FIX = join(ROOT, 'tests', 'fixtures');

let pass = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log(`  FAIL  ${name}\n          ${e.message}`);
  }
}

function eq(actual, expected, what = '') {
  if (actual !== expected) throw new Error(`${what} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function throws(fn, re) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  if (!threw) throw new Error('expected a throw, got none');
  if (re && !re.test(threw.message)) throw new Error(`message did not match ${re}: ${threw.message}`);
}

function cli(args, { expectCode } = {}) {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
    if (expectCode !== undefined && expectCode !== 0) throw new Error(`expected exit ${expectCode}, got 0`);
    return { code: 0, out };
  } catch (e) {
    if (e.status === undefined) throw e;
    if (expectCode !== undefined) eq(e.status, expectCode, 'exit code');
    return { code: e.status, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

const G = (body) => parseLedgerText(body, '<test>');

console.log('\nledger parsing');

t('a ticked box with pending evidence is UNMET, not MET', () => {
  const l = G(`- [x] A1: done\n  CHECK: true\n  EXPECT: ok\n  EVIDENCE: pending\n`);
  eq(l.gates[0].state, STATE.UNMET);
  eq(l.gates[0].selfReported, true);
});

t('a ticked box with real evidence is MET', () => {
  const l = G(`- [x] A1: done\n  CHECK: true\n  EXPECT: ok\n  EVIDENCE: proven | exit=0 | expect=matched\n`);
  eq(l.gates[0].state, STATE.MET);
});

t('an empty evidence line is treated as pending', () => {
  const l = G(`- [x] A1: done\n  CHECK: true\n  EXPECT: ok\n  EVIDENCE:\n`);
  eq(l.gates[0].state, STATE.UNMET);
});

t('a zero-gate ledger is rejected rather than reported as passing', () => {
  throws(() => G('# just a heading\n\nsome prose\n'), /no gates found/);
});

t('duplicate gate ids are rejected', () => {
  throws(() => G(`- [ ] A1: one\n  CHECK: true\n  EXPECT: ok\n\n- [ ] A1: two\n  CHECK: true\n  EXPECT: ok\n`), /duplicate gate id/);
});

t('a CHECK with no EXPECT is rejected', () => {
  throws(() => G(`- [ ] A1: one\n  CHECK: true\n`), /no EXPECT/);
});

t('a gate with neither CHECK nor ATTEST is rejected', () => {
  throws(() => G(`- [ ] A1: one\n  RISK: high\n`), /neither a CHECK/);
});

t('abandonment without a reason is rejected', () => {
  throws(() => G(`- [-] A1: gave up\n  CHECK: true\n  EXPECT: ok\n`), /no REASON/);
});

t('abandonment with a reason is ABANDONED and is not success', () => {
  const l = G(`- [-] A1: gave up\n  CHECK: true\n  EXPECT: ok\n  REASON: the upstream API is retired\n`);
  eq(l.gates[0].state, STATE.ABANDONED);
  eq(summarise(l).handoff, true);
  eq(summarise(l).allMet, false);
});

t('an attested box without an ATTEST line is rejected', () => {
  throws(() => G(`- [~] A1: reviewed\n  CHECK: true\n  EXPECT: ok\n`), /no ATTEST/);
});

t('attested gates are counted apart from machine-proven ones', () => {
  const l = G(`- [~] A1: reviewed\n  ATTEST: Ragnar Pitla <r@example.com> on 2026-08-30\n`);
  eq(l.gates[0].state, STATE.ATTESTED);
  const s = summarise(l);
  eq(s.machineProven, 0);
  eq(s.humanAttested, 1);
});

t('gates inside fenced code blocks are ignored', () => {
  const l = G('- [ ] A1: real\n  CHECK: true\n  EXPECT: ok\n\n```\n- [x] FAKE: from the docs\n  CHECK: true\n  EXPECT: ok\n  EVIDENCE: proven\n```\n');
  eq(l.gates.length, 1);
  eq(l.gates[0].id, 'A1');
});

t('CRLF line endings are preserved', () => {
  const l = parseLedgerText(`- [ ] A1: one\r\n  CHECK: true\r\n  EXPECT: ok\r\n`, '<test>');
  eq(l.eol, '\r\n');
});

console.log('\nlinting');

t('an echo oracle is flagged', () => {
  const f = lint(G(`- [ ] A1: x\n  CHECK: echo ok\n  EXPECT: ok\n`));
  if (!f.some((x) => x.rule === 'echo-oracle')) throw new Error('not flagged');
});

t('a command that swallows its own failure is flagged', () => {
  const f = lint(G(`- [ ] A1: x\n  CHECK: npm test || true\n  EXPECT: all tests passed\n`));
  if (!f.some((x) => x.rule === 'true-tail')) throw new Error('not flagged');
});

t('an expectation written inside its own command is flagged', () => {
  const f = lint(G(`- [ ] A1: x\n  CHECK: printf 'BUILD GREEN'\n  EXPECT: BUILD GREEN\n`));
  if (!f.some((x) => x.rule === 'expect-in-check')) throw new Error('not flagged');
});

t('an unnamed attestation is flagged', () => {
  const f = lint(G(`- [~] A1: x\n  ATTEST: someone\n`));
  if (!f.some((x) => x.rule === 'attest-unnamed')) throw new Error('not flagged');
});

t('a strong gate produces no findings', () => {
  const f = lint(G(`- [ ] A1: skill is on the agent\n  CHECK: node bin/receipts.mjs probe skill-deployed --path ./skills\n  EXPECT: PROOF OK\n  EVIDENCE: pending\n`));
  eq(f.length, 0, 'findings');
});

console.log('\ncopilot studio probes');

t('skill-deployed passes when the component is really there', () => {
  const r = cli(['probe', 'skill-deployed', '--path', `${FIX}/skills/match-exception-explainer`, '--fixture', `${FIX}/agent-healthy.json`], { expectCode: 0 });
  if (!r.out.startsWith('PROOF OK')) throw new Error(r.out);
});

t('skill-deployed catches a push that reported success and created nothing', () => {
  const r = cli(['probe', 'skill-deployed', '--path', `${FIX}/skills/match-exception-explainer`, '--fixture', `${FIX}/agent-push-trap.json`], { expectCode: 1 });
  if (!/PROOF FAIL/.test(r.out)) throw new Error(r.out);
  if (!/MISSING: match-exception-explainer/.test(r.out)) throw new Error(r.out);
});

t('skill-matches compares deployed bytes against source', () => {
  cli(['probe', 'skill-matches', '--path', `${FIX}/skills/match-exception-explainer`, '--fixture', `${FIX}/agent-healthy.json`], { expectCode: 0 });
});

t('skill-matches reports divergence when source has moved on', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dil-'));
  const sk = join(dir, 'match-exception-explainer');
  execFileSync('mkdir', ['-p', sk]);
  writeFileSync(join(sk, 'SKILL.md'), '---\nname: match-exception-explainer\ndescription: changed\n---\n\ndifferent content\n');
  const r = cli(['probe', 'skill-matches', '--path', sk, '--fixture', `${FIX}/agent-healthy.json`], { expectCode: 1 });
  if (!/DIVERGED/.test(r.out)) throw new Error(r.out);
  rmSync(dir, { recursive: true, force: true });
});

t('harness distinguishes the GitHub Copilot harness from the standard one', () => {
  cli(['probe', 'harness', '--expect', 'github-copilot', '--fixture', `${FIX}/agent-healthy.json`], { expectCode: 0 });
  cli(['probe', 'harness', '--expect', 'standard', '--fixture', `${FIX}/agent-healthy.json`], { expectCode: 1 });
});

t('component-count discriminates on kind, not componenttype', () => {
  const r = cli(['probe', 'component-count', '--kind', 'InlineAgentSkill', '--min', '1', '--fixture', `${FIX}/agent-healthy.json`], { expectCode: 0 });
  if (!/McpTool/.test(r.out)) throw new Error('expected the kind breakdown in the detail');
});

t('skill-quality fails a skill that is missing rubric sections', () => {
  const r = cli(['probe', 'skill-quality', '--path', `${FIX}/skills`], { expectCode: 1 });
  if (!/FAIL {2}weak-skill/.test(r.out)) throw new Error(r.out);
});

t('skill-quality passes a skill that answers every rubric question', () => {
  cli(['probe', 'skill-quality', '--path', `${FIX}/skills/match-exception-explainer`], { expectCode: 0 });
});

t('eval-coverage names skills that ship with nothing measuring them', () => {
  const r = cli(['probe', 'eval-coverage', '--path', `${FIX}/skills`, '--evals', `${FIX}/evals`], { expectCode: 1 });
  if (!/UNCOVERED: weak-skill/.test(r.out)) throw new Error(r.out);
});

t('a probe that cannot run fails its gate instead of passing by silence', () => {
  const r = cli(['probe', 'skill-deployed', '--path', '/nonexistent/path', '--fixture', `${FIX}/agent-healthy.json`], { expectCode: 1 });
  if (!/PROOF FAIL/.test(r.out)) throw new Error(r.out);
});

console.log('\ncli behaviour');

t('status executes nothing and still reports a self-reported tick', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'dil-')), 'GATES.md');
  writeFileSync(f, `- [x] A1: claimed\n  CHECK: touch /tmp/receipts-should-not-exist-${process.pid}\n  EXPECT: ok\n  EVIDENCE: pending\n`);
  const r = cli(['status', f], { expectCode: 1 });
  if (!/SELF-REPORTED/.test(r.out)) throw new Error(r.out);
  execFileSync('sh', ['-c', `test ! -e /tmp/receipts-should-not-exist-${process.pid}`]);
});

t('--approve is a boolean flag and does not swallow the ledger path', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'dil-')), 'GATES.md');
  writeFileSync(f, `- [ ] A1: probe runs\n  CHECK: node bin/receipts.mjs probe harness --expect github-copilot --fixture ${FIX}/agent-healthy.json\n  EXPECT: PROOF OK\n  EVIDENCE: pending\n`);
  const r = cli(['check', '--approve', f], { expectCode: 0 });
  if (/no ledger at GATES.md/.test(r.out)) throw new Error('the flag consumed the path');
  if (!/ALL MET/.test(r.out)) throw new Error(r.out);
});

t('a failed check removes the tick instead of leaving a false one', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'dil-')), 'GATES.md');
  writeFileSync(f, `- [x] A1: lied about\n  CHECK: node bin/receipts.mjs probe harness --expect standard --fixture ${FIX}/agent-healthy.json\n  EXPECT: PROOF OK\n  EVIDENCE: proven | exit=0 | expect=matched | forged\n`);
  cli(['check', '--approve', '--reverify', f], { expectCode: 1 });
  const after = readFileSync(f, 'utf8');
  if (!/^- \[ \] A1/m.test(after)) throw new Error(`tick was not removed:\n${after}`);
  if (!/EVIDENCE: pending/.test(after)) throw new Error(`evidence was not reset:\n${after}`);
});

t('evidence records the oracle result but never the raw output', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'dil-')), 'GATES.md');
  writeFileSync(f, `- [ ] A1: proven\n  CHECK: node bin/receipts.mjs probe harness --expect github-copilot --fixture ${FIX}/agent-healthy.json\n  EXPECT: PROOF OK\n  EVIDENCE: pending\n`);
  cli(['check', '--approve', f], { expectCode: 0 });
  const after = readFileSync(f, 'utf8');
  if (!/EVIDENCE: proven \| exit=0 \| expect=matched/.test(after)) throw new Error(after);
  if (!/output=sha256:[0-9a-f]{16} bytes=\d+/.test(after)) throw new Error('no output fingerprint');
  if (/CLICopilotRecognizer/.test(after)) throw new Error('raw output leaked into the ledger');
});

t('an invalid ledger exits 2, distinct from an unmet ledger exiting 1', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'dil-')), 'GATES.md');
  writeFileSync(f, '# nothing here\n');
  cli(['status', f], { expectCode: 2 });
});

t('lint is advisory by default and fails only under --strict', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'dil-')), 'GATES.md');
  writeFileSync(f, `- [ ] A1: x\n  CHECK: echo ok\n  EXPECT: ok\n  EVIDENCE: pending\n`);
  cli(['lint', f], { expectCode: 0 });
  cli(['lint', '--strict', f], { expectCode: 1 });
});

t('report escapes evidence pipes so the markdown table survives', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'dil-')), 'GATES.md');
  writeFileSync(f, `- [x] A1: proven\n  CHECK: true\n  EXPECT: ok\n  EVIDENCE: proven | exit=0 | expect=matched\n`);
  const r = cli(['report', f], { expectCode: 0 });
  const row = r.out.split('\n').find((l) => l.startsWith('| A1 '));
  eq(row.split('|').filter((x) => x !== '').length, 4, 'table columns');
});

console.log(`\n${pass} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
