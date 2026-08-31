// Approval records.
//
// A CHECK: line is shell code. Running it because a file said so is the same
// class of mistake this project exists to prevent, so the first time an exact
// oracle is seen it is printed and not run. Approval binds the record to every
// input that changes what the command does.

import { mkdirSync, readFileSync, writeFileSync, statSync, realpathSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export function approvalDir() {
  const custom = process.env.RECEIPTS_APPROVAL_DIR;
  const dir = custom ? resolve(custom) : join(homedir(), '.agent-receipts', 'approved');
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const real = realpathSync(dir);
  const repo = realpathSync(process.cwd());
  if (real === repo || real.startsWith(repo + '/')) {
    throw new Error(
      `approval store ${real} resolves inside the working repository. ` +
        `A store the checked-in code can edit is not an approval store. Set RECEIPTS_APPROVAL_DIR elsewhere.`
    );
  }
  const st = statSync(real);
  if ((st.mode & 0o077) !== 0) {
    throw new Error(`approval store ${real} is group or world accessible. Run: chmod 700 "${real}"`);
  }
  return real;
}

/**
 * Every input that can change what the command does goes into the key. Editing
 * any of them means the approval no longer applies.
 */
export function approvalKey({ ledgerPath, gateId, check, expect, cwd, shell, timeout }) {
  const bound = JSON.stringify({
    ledger: resolve(ledgerPath),
    gate: gateId,
    check,
    expect,
    cwd: resolve(cwd),
    shell,
    timeout,
    platform: process.platform,
    path: process.env.PATH ?? '',
  });
  return createHash('sha256').update(bound).digest('hex');
}

export function isApproved(key) {
  const file = join(approvalDir(), `${key}.json`);
  if (!existsSync(file)) return false;
  const st = statSync(file);
  if (!st.isFile() || st.nlink !== 1) return false;
  if ((st.mode & 0o077) !== 0) return false;
  try {
    return JSON.parse(readFileSync(file, 'utf8')).key === key;
  } catch {
    return false;
  }
}

export function approve(key, meta) {
  const file = join(approvalDir(), `${key}.json`);
  writeFileSync(file, JSON.stringify({ key, approvedAt: new Date().toISOString(), ...meta }, null, 2), {
    mode: 0o600,
  });
  return file;
}

export function pathFingerprint() {
  const p = process.env.PATH ?? '';
  return `${createHash('sha256').update(p).digest('hex').slice(0, 12)} (${p.split(':').length} entries)`;
}
