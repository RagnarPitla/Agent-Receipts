// Execute gate checks and write evidence.
//
// A gate passes only when the process exits 0 AND the declared EXPECT: string
// appears in combined output. Either one alone is not proof: a command can
// print a success banner and exit 1, and a command can exit 0 having done
// nothing at all.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { STATE, updateGate, saveLedger } from './ledger.mjs';
import { approvalKey, isApproved, approve, pathFingerprint } from './approval.mjs';

const DEFAULT_TIMEOUT = 300_000;

export function resolveShell(explicit) {
  if (explicit) return explicit;
  if (process.env.RECEIPTS_SHELL) return process.env.RECEIPTS_SHELL;
  return process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
}

function run(cmd, { cwd, shell, timeout }) {
  return new Promise((done) => {
    const started = Date.now();
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', cmd] : ['-c', cmd];
    const child = spawn(shell, args, { cwd, windowsHide: true });

    let out = '';
    let capped = false;
    const LIMIT = 2_000_000;
    const take = (buf) => {
      if (capped) return;
      out += buf.toString();
      if (out.length > LIMIT) {
        out = out.slice(0, LIMIT);
        capped = true;
      }
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);

    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      done({ code: null, timedOut: true, out, ms: Date.now() - started, capped });
    }, timeout);

    child.on('error', (err) => {
      clearTimeout(timer);
      done({ code: null, error: err.message, out, ms: Date.now() - started, capped });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, out, ms: Date.now() - started, capped });
    });
  });
}

function fingerprint(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 16)} bytes=${Buffer.byteLength(text)}`;
}

/**
 * Run one gate. Returns { gate, met, evidence, transcript }.
 * `mode` is 'normal' | 'approve' | 'status'.
 */
export async function runGate(ledger, gate, opts) {
  const { mode = 'normal', shell: shellOpt, log = console.log } = opts;
  const cwd = resolve(gate.fields.CWD ? resolve(process.cwd(), gate.fields.CWD) : process.cwd());
  const shell = resolveShell(gate.fields.SHELL || shellOpt);
  const timeout = Number(gate.fields.TIMEOUT || DEFAULT_TIMEOUT);
  const check = gate.fields.CHECK;
  const expect = gate.fields.EXPECT;

  const key = approvalKey({ ledgerPath: ledger.path, gateId: gate.id, check, expect, cwd, shell, timeout });
  const approved = isApproved(key);

  if (mode === 'approve' && !approved) {
    approve(key, { ledger: ledger.path, gate: gate.id, check, expect, cwd, shell, timeout });
  } else if (!approved) {
    log(`  ${gate.id}  NOT YET APPROVED - printing the oracle instead of running it`);
    log(`    command : ${check}`);
    log(`    expects : ${expect}`);
    log(`    cwd     : ${cwd}`);
    log(`    shell   : ${shell}`);
    log(`    PATH    : ${pathFingerprint()}`);
    log(`    Read the command and everything it calls, then re-run with --approve.`);
    return { gate, met: false, skipped: 'unapproved' };
  }

  const r = await run(check, { cwd, shell, timeout });
  const matched = typeof r.out === 'string' && r.out.includes(expect);
  const met = r.code === 0 && matched;

  const bits = [
    met ? 'proven' : 'FAILED',
    `exit=${r.timedOut ? 'timeout' : r.code}`,
    `expect=${matched ? 'matched' : 'not found'}`,
    `shell=${shell}`,
    `cwd=${cwd}`,
    `path=${pathFingerprint()}`,
    `ms=${r.ms}`,
    met ? `output=${fingerprint(r.out)}` : null,
    `at=${new Date().toISOString()}`,
  ].filter(Boolean);

  const evidence = bits.join(' | ');

  if (met) {
    updateGate(ledger, gate.id, { box: 'ticked', evidence });
  } else {
    // Never leave a tick behind a failure.
    updateGate(ledger, gate.id, { box: 'open', evidence: `pending (last attempt: ${evidence})` });
  }

  return { gate, met, evidence, failureOutput: met ? null : tail(r.out) };
}

function tail(s, n = 1200) {
  if (!s) return '(no output)';
  return s.length <= n ? s : `...\n${s.slice(-n)}`;
}

export async function runLedger(ledger, opts = {}) {
  const { reverify = false, log = console.log } = opts;
  const results = [];
  const targets = ledger.gates.filter((g) => {
    if (!g.runnable) return false;
    if (g.state === STATE.ABANDONED) return false;
    if (g.state === STATE.MET && !reverify) return false;
    return true;
  });

  for (const gate of targets) {
    const res = await runGate(ledger, gate, opts);
    results.push(res);
    if (res.skipped) continue;
    log(`  ${res.met ? 'PROVEN ' : 'FAILED '} ${gate.id}: ${gate.title}`);
    if (!res.met && res.failureOutput) {
      log(indent(res.failureOutput, '           '));
    }
  }

  if (results.some((r) => !r.skipped)) saveLedger(ledger);
  return results;
}

function indent(text, pad) {
  return text
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}
