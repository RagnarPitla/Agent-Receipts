#!/usr/bin/env node
// Agent Receipts: the CLI.
//
//   receipts status  <ledger>   read the ledger, execute nothing
//   receipts check   <ledger>   run unproven gates and write evidence
//   receipts lint    <ledger>   advisory checks on ledger strength
//   receipts report  <ledger>   a report you can paste into a PR
//   receipts probe   <name>     verify one fact about a Copilot Studio agent
//   receipts init    [dir]      write a starter ledger

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLedger, summarise, STATE, LedgerError } from '../src/ledger.mjs';
import { runLedger } from '../src/runner.mjs';
import { lint } from '../src/lint.mjs';
import { PROBES } from '../src/probes/index.mjs';
import { ProbeError } from '../src/probes/dataverse.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const VERSION = '0.1.0';

// Flags that never take a value. Without this list, `--approve GATES.md`
// silently consumes the ledger path as the flag's argument and the command
// then reports "no ledger at GATES.md".
const BOOLEAN_FLAGS = new Set(['approve', 'cached', 'strict', 'help', 'version']);

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=');
      if (inline !== undefined) flags[k] = inline;
      else if (BOOLEAN_FLAGS.has(k)) flags[k] = true;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i];
      else flags[k] = true;
    } else rest.push(a);
  }
  return { flags, rest };
}

const HELP = `Agent Receipts ${VERSION} - proof of work for agents.

  receipts status <ledger>              read the ledger. Executes nothing, ever.
  receipts check  <ledger> [--approve] [--cached] [--shell <sh>]
  receipts lint   <ledger> [--strict]
  receipts report <ledger> [--out <file>]
  receipts init   [dir] [--preset copilot-studio|generic]
  receipts probe  <name> [options]

Probes (Copilot Studio):
  skill-deployed        --path <dir> | --name <skill>   is the skill actually on the agent
  skill-matches         --path <dir>                    deployed bytes equal source bytes
  no-orphan-skills      --path <dir>                    agent and source agree exactly
  harness               --expect github-copilot         which harness the agent runs
  component-count       --kind <Kind> --min <n>         components present, by kind
  instructions-contain  --text "<clause>"               a required clause is in instructions
  skill-quality         --path <dir> [--min <n>]        offline rubric, no environment needed
  eval-coverage         --path <dir> --evals <dir>      every skill has a measurement

Probe targets:  --env-url <dataverse-url> --bot-id <guid>
                --fixture <file.json>     offline, deterministic, for CI

Exit codes:  0 everything proven   1 something unproven   2 the ledger itself is invalid
`;

function boxOf(g) {
  return { OPEN: '[ ]', MET: '[x]', UNMET: '[!]', ATTESTED: '[~]', ABANDONED: '[-]' }[g.state];
}

function printStatus(ledger) {
  const s = summarise(ledger);
  console.log(`\n${ledger.path}\n`);
  for (const g of ledger.gates) {
    console.log(`  ${boxOf(g)} ${g.id}: ${g.title}`);
    if (g.state === STATE.UNMET && g.selfReported) {
      console.log(`      SELF-REPORTED. The box is ticked and the evidence is still pending.`);
      console.log(`      This counts as unmet. An empty box is more honest than this one.`);
    }
    if (g.state === STATE.ATTESTED) console.log(`      attested by ${g.fields.ATTEST}`);
    if (g.state === STATE.ABANDONED) console.log(`      abandoned: ${g.fields.REASON}`);
  }
  console.log('');
  console.log(`  proven ${s.counts.MET}   attested ${s.counts.ATTESTED}   open ${s.counts.OPEN}` +
    `   self-reported ${s.counts.UNMET}   abandoned ${s.counts.ABANDONED}   of ${s.total}`);
  return s;
}

function outcome(s) {
  if (s.handoff) {
    console.log('\n  HANDOFF REQUIRED - at least one gate was abandoned. This is not success.\n');
    return 1;
  }
  if (s.allMet) {
    console.log('\n  ALL MET\n');
    return 0;
  }
  console.log('\n  NOT MET\n');
  return 1;
}

async function main() {
  const [, , ...tail] = process.argv;
  // A leading flag is not a command. `receipts --help` must not be read as a
  // command named "--help" and fall through to the default ledger path.
  const cmd = tail[0] && !tail[0].startsWith('--') ? tail[0] : undefined;
  const { flags, rest } = parseArgs(cmd ? tail.slice(1) : tail);

  if (cmd === 'version' || flags.version) { console.log(VERSION); return 0; }
  if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); return 0; }

  if (cmd === 'probe') {
    const name = rest[0];
    const probe = PROBES[name];
    if (!probe) {
      console.error(`unknown probe "${name}". Known: ${Object.keys(PROBES).join(', ')}`);
      return 2;
    }
    const args = {
      ...flags,
      envUrl: flags['env-url'] ?? process.env.MCS_ENV_URL,
      botId: flags['bot-id'] ?? process.env.MCS_BOT_ID,
      fixture: flags.fixture,
    };
    try {
      return await probe(args);
    } catch (e) {
      console.log(`PROOF FAIL probe "${name}" could not complete`);
      console.log(`  ${e instanceof ProbeError ? e.message : (e.stack ?? e.message)}`);
      return 1;
    }
  }

  if (cmd === 'init') {
    const dir = rest[0] ?? '.';
    const preset = flags.preset === 'generic' ? 'GATES.generic.md' : 'GATES.copilot-studio.md';
    const src = join(ROOT, 'templates', preset);
    const dest = join(dir, 'GATES.md');
    if (existsSync(dest)) { console.error(`${dest} already exists. Refusing to overwrite a ledger.`); return 2; }
    mkdirSync(dir, { recursive: true });
    writeFileSync(dest, readFileSync(src, 'utf8'));
    console.log(`wrote ${dest}`);
    console.log(`Replace every placeholder, then: receipts status ${dest}`);
    return 0;
  }

  const target = rest[0] ?? 'GATES.md';
  if (!existsSync(target)) { console.error(`no ledger at ${target}`); return 2; }

  let ledger;
  try {
    ledger = parseLedger(target);
  } catch (e) {
    if (e instanceof LedgerError) { console.error(`\n  INVALID LEDGER\n  ${e.message}\n`); return 2; }
    throw e;
  }

  if (cmd === 'status') return outcome(printStatus(ledger));

  if (cmd === 'lint') {
    const findings = lint(ledger);
    if (findings.length === 0) { console.log('\n  no weak patterns found\n'); return 0; }
    console.log('');
    for (const f of findings) console.log(`  ${f.gate}  ${f.rule}: ${f.why}`);
    console.log(`\n  ${findings.length} advisory finding(s)${flags.strict ? ' (strict: failing)' : ''}\n`);
    return flags.strict ? 1 : 0;
  }

  if (cmd === 'report') {
    const md = report(ledger);
    if (flags.out) { writeFileSync(flags.out, md); console.log(`wrote ${flags.out}`); }
    else console.log(md);
    return summarise(ledger).allMet ? 0 : 1;
  }

  if (cmd === 'check') {
    console.log(`\n${ledger.path}\n`);
    const results = await runLedger(ledger, {
      mode: flags.approve ? 'approve' : 'normal',
      cached: !!flags.cached,
      shell: typeof flags.shell === 'string' ? flags.shell : undefined,
    });
    const fresh = parseLedger(target);
    const summary = printStatus(fresh);

    // A gate this run could not execute is not a gate this run proved. Its tick
    // is a claim from some earlier run against a system that has since changed,
    // which is the exact thing this tool exists to refuse. This has to be decided
    // before the verdict is printed, or the run announces success and then takes
    // it back.
    const unverified = results.filter((r) => r.skipped).map((r) => r.gate.id);
    if (unverified.length > 0) {
      console.log(`\n  NOT VERIFIED - ${unverified.length} gate(s) did not run: ${unverified.join(', ')}`);
      console.log(`  Their boxes reflect an earlier run, not this one, so this run cannot report success.\n`);
      return 1;
    }
    return outcome(summary);
  }

  console.error(`unknown command "${cmd}"\n`);
  console.log(HELP);
  return 2;
}

function report(ledger) {
  const s = summarise(ledger);
  const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const rows = ledger.gates.map((g) => {
    const state = { MET: 'proven', UNMET: 'SELF-REPORTED', OPEN: 'open', ATTESTED: 'attested', ABANDONED: 'abandoned' }[g.state];
    let how;
    if (g.state === STATE.ATTESTED) how = g.fields.ATTEST;
    else if (g.state === STATE.ABANDONED) how = g.fields.REASON;
    else if (g.state === STATE.MET) how = (g.fields.EVIDENCE ?? '').split(' | ').slice(0, 3).join(', ');
    else if (!g.runnable && g.attestable) how = 'awaiting attestation';
    else how = 'no evidence';
    return `| ${cell(g.id)} | ${cell(g.title)} | ${state} | ${cell(how)} |`;
  });
  return [
    `## Receipts report`,
    '',
    `Ledger: \`${ledger.path}\`  `,
    `Generated: ${new Date().toISOString()}`,
    '',
    `**${s.counts.MET} proven by machine, ${s.counts.ATTESTED} attested by a named human, ` +
      `${s.counts.OPEN} open, ${s.counts.UNMET} self-reported and rejected, ${s.counts.ABANDONED} abandoned.**`,
    '',
    '| Gate | Outcome | State | Evidence |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    s.allMet ? 'All gates met.' : 'Not all gates are met. This work is not finished.',
    '',
    '<sub>Evidence records exit status, expectation match, resolved shell and working directory, ' +
      'and a fingerprint of successful output. Raw output is never persisted.</sub>',
  ].join('\n');
}

main()
  .then((code) => process.exit(code))
  .catch((e) => { console.error(e.stack ?? e.message); process.exit(2); });
