// Advisory linting for weak ledgers.
//
// The checker can only prove the oracle you declared. It cannot know whether an
// English title and a line of shell mean the same thing. These are the
// mechanical shapes that let a gate pass while proving nothing.

const RULES = [
  {
    id: 'echo-oracle',
    test: (g) => /^\s*(echo|printf)\b/.test(g.fields.CHECK ?? ''),
    why: 'the check only prints its own expectation, so it passes whatever the code does',
  },
  {
    id: 'expect-in-check',
    test: (g) => {
      const c = g.fields.CHECK ?? '';
      const e = (g.fields.EXPECT ?? '').trim();
      return e.length > 3 && c.includes(e);
    },
    why: 'the expected string is written inside the command, so the command cannot fail the match',
  },
  {
    id: 'true-tail',
    test: (g) => /(\|\|\s*true|;\s*true\s*$|\|\|\s*:)/.test(g.fields.CHECK ?? ''),
    why: 'the command swallows its own failure, so exit 0 is guaranteed',
  },
  {
    id: 'weak-expect',
    test: (g) => {
      const e = (g.fields.EXPECT ?? '').trim();
      return e.length > 0 && (e.length < 4 || /^(ok|done|pass|yes|0|true)$/i.test(e));
    },
    why: 'the expectation is short enough to appear in unrelated output by accident',
  },
  {
    id: 'no-assertion',
    test: (g) => {
      const c = g.fields.CHECK ?? '';
      return /^\s*(ls|cat|find|pwd|which|head|tail|wc)\b/.test(c);
    },
    why: 'listing or printing a file shows it exists, not that it is correct',
  },
  {
    id: 'self-report',
    test: (g) => g.state === 'UNMET' && g.selfReported,
    why: 'the box is ticked but the evidence line is still pending, which is the agent grading itself',
  },
  {
    id: 'attest-unnamed',
    test: (g) => g.attestable && !/[A-Za-z]{2,}\s*<|@|\bby\b/i.test(g.fields.ATTEST ?? ''),
    why: 'the attestation does not name a person, so nobody is accountable for it',
  },
];

export function lint(ledger) {
  const findings = [];
  for (const g of ledger.gates) {
    for (const rule of RULES) {
      let hit = false;
      try { hit = rule.test(g); } catch { hit = false; }
      if (hit) findings.push({ gate: g.id, rule: rule.id, why: rule.why });
    }
  }
  return findings;
}

export const RULE_IDS = RULES.map((r) => r.id);
