// Proof ledger: parse, validate and rewrite GATES.md.
//
// The ledger is the only place a gate's state is allowed to live. Nothing here
// trusts a checkbox on its own: a ticked box whose EVIDENCE line still reads
// "pending" is reported as UNMET, because that state is an agent marking its
// own homework.

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export const STATE = {
  OPEN: 'OPEN',
  MET: 'MET',
  UNMET: 'UNMET',
  ATTESTED: 'ATTESTED',
  ABANDONED: 'ABANDONED',
};

const BOX = { ' ': 'open', x: 'ticked', X: 'ticked', '~': 'attested', '-': 'abandoned' };

const GATE_RE = /^(\s*)-\s*\[([ xX~-])\]\s*([A-Za-z][A-Za-z0-9_.-]*)\s*:\s*(.+?)\s*$/;
const FIELD_RE = /^(\s*)(CHECK|EXPECT|EVIDENCE|CWD|OWNS|RISK|ATTEST|REASON|SHELL|TIMEOUT):\s*(.*?)\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;

const PENDING = new Set(['pending', 'PENDING', '', 'todo', 'TODO', 'n/a', 'none']);

export class LedgerError extends Error {}

/**
 * Parse a ledger. Returns { path, eol, lines, gates }.
 * Fenced code blocks are ignored so documentation examples never become gates.
 */
export function parseLedger(path) {
  const raw = readFileSync(path, 'utf8');
  return parseLedgerText(raw, path);
}

export function parseLedgerText(raw, path = '<memory>') {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);

  const gates = [];
  const seen = new Map();
  let inFence = false;
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const gm = GATE_RE.exec(line);
    if (gm) {
      const [, indent, box, id, title] = gm;
      if (seen.has(id)) {
        throw new LedgerError(
          `${path}: duplicate gate id "${id}" (first seen on line ${seen.get(id) + 1}, again on line ${i + 1})`
        );
      }
      seen.set(id, i);
      current = {
        id,
        title,
        box: BOX[box],
        indent,
        line: i,
        fields: {},
        fieldLines: {},
      };
      gates.push(current);
      continue;
    }

    const fm = FIELD_RE.exec(line);
    if (fm && current) {
      const [, , key, value] = fm;
      current.fields[key] = value;
      current.fieldLines[key] = i;
      continue;
    }

    // A non-indented, non-empty line that is not a field ends the current gate block.
    if (line.trim() !== '' && !/^\s/.test(line)) current = null;
  }

  if (gates.length === 0) {
    throw new LedgerError(
      `${path}: no gates found. A ledger with zero gates cannot prove anything, so it is rejected rather than reported as passing.`
    );
  }

  for (const g of gates) classify(g, path);

  return { path, eol, lines, gates };
}

function classify(g, path) {
  const f = g.fields;
  const hasCheck = typeof f.CHECK === 'string' && f.CHECK.trim() !== '';
  const hasExpect = typeof f.EXPECT === 'string' && f.EXPECT.trim() !== '';
  const evidence = (f.EVIDENCE ?? '').trim();
  const hasEvidence = evidence !== '' && !PENDING.has(evidence);

  g.runnable = hasCheck;
  g.attestable = typeof f.ATTEST === 'string' && f.ATTEST.trim() !== '';

  if (g.box === 'abandoned') {
    const reason = (f.REASON ?? '').trim();
    if (!reason) {
      throw new LedgerError(
        `${path}: gate "${g.id}" is marked abandoned but has no REASON:. Abandonment is a handoff on the record, not a silent drop.`
      );
    }
    g.state = STATE.ABANDONED;
    return;
  }

  if (g.box === 'attested') {
    if (!g.attestable) {
      throw new LedgerError(
        `${path}: gate "${g.id}" uses the attested box [~] but has no ATTEST: line naming who signed it off.`
      );
    }
    g.state = STATE.ATTESTED;
    return;
  }

  if (hasCheck && !hasExpect) {
    throw new LedgerError(
      `${path}: gate "${g.id}" has a CHECK: but no EXPECT:. A command with no declared expectation proves only that something ran.`
    );
  }

  if (!hasCheck && !g.attestable) {
    throw new LedgerError(
      `${path}: gate "${g.id}" has neither a CHECK: nor an ATTEST:. Every gate needs either a machine oracle or a named human.`
    );
  }

  if (g.box === 'ticked') {
    // The central rule of the whole system.
    g.state = hasEvidence ? STATE.MET : STATE.UNMET;
    if (!hasEvidence) {
      g.selfReported = true;
    }
    return;
  }

  g.state = STATE.OPEN;
}

/** Gates that a run should attempt, in ledger order. */
export function runnableGates(ledger, { reverify = false } = {}) {
  return ledger.gates.filter((g) => {
    if (!g.runnable) return false;
    if (g.state === STATE.ABANDONED) return false;
    if (g.state === STATE.MET && !reverify) return false;
    return true;
  });
}

export function summarise(ledger) {
  const counts = { OPEN: 0, MET: 0, UNMET: 0, ATTESTED: 0, ABANDONED: 0 };
  for (const g of ledger.gates) counts[g.state]++;
  const provable = ledger.gates.filter((g) => g.state !== STATE.ABANDONED);
  const allMet = provable.length > 0 && provable.every(
    (g) => g.state === STATE.MET || g.state === STATE.ATTESTED
  );
  return {
    counts,
    total: ledger.gates.length,
    allMet,
    handoff: counts.ABANDONED > 0,
    machineProven: counts.MET,
    humanAttested: counts.ATTESTED,
  };
}

/**
 * Rewrite one gate's box and EVIDENCE line in place, preserving line endings.
 * Written to a temp file then renamed, so an interrupted run cannot leave a
 * half-written ledger behind.
 */
export function updateGate(ledger, id, { box, evidence, reason, attest }) {
  const g = ledger.gates.find((x) => x.id === id);
  if (!g) throw new LedgerError(`no gate "${id}" in ${ledger.path}`);

  const boxChar = { open: ' ', ticked: 'x', attested: '~', abandoned: '-' }[box] ?? ' ';
  const head = ledger.lines[g.line];
  ledger.lines[g.line] = head.replace(
    /-\s*\[[ xX~-]\]/,
    `- [${boxChar}]`
  );
  g.box = box;

  const setField = (key, value) => {
    if (value === undefined) return;
    const at = g.fieldLines[key];
    const indent = g.indent + '  ';
    if (at !== undefined) {
      ledger.lines[at] = `${indent}${key}: ${value}`;
    } else {
      // Insert after the last known field of this gate, or straight after the head.
      const known = Object.values(g.fieldLines);
      const insertAfter = known.length ? Math.max(...known) : g.line;
      ledger.lines.splice(insertAfter + 1, 0, `${indent}${key}: ${value}`);
      reindex(ledger, insertAfter + 1);
      g.fieldLines[key] = insertAfter + 1;
    }
    g.fields[key] = value;
  };

  setField('EVIDENCE', evidence);
  setField('REASON', reason);
  setField('ATTEST', attest);

  return g;
}

function reindex(ledger, insertedAt) {
  for (const g of ledger.gates) {
    if (g.line >= insertedAt) g.line++;
    for (const k of Object.keys(g.fieldLines)) {
      if (g.fieldLines[k] >= insertedAt) g.fieldLines[k]++;
    }
  }
}

export function saveLedger(ledger) {
  const text = ledger.lines.join(ledger.eol);
  const tmp = `${ledger.path}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, ledger.path);
}
