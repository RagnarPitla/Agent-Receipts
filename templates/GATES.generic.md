# Proof ledger: <project name>

Every line below is an outcome that must be true before this work is done.
Replace every placeholder with a check that would actually fail if the outcome
were missing. A ledger copied unchanged proves nothing about your project.

Ticking a box by hand does not close a gate. `receipts check` runs the CHECK,
compares stdout against EXPECT, and writes what it saw into EVIDENCE. A ticked
box still reading `EVIDENCE: pending` is reported as unmet.

Write checks that observe the running system, not the source. `grep` for a
function name proves the code was typed, not that it works.

## The change does what it claims

- [ ] G1: <the behaviour a user would notice, stated as an outcome>
  CHECK: <command that exercises that behaviour end to end>
  EXPECT: <a string only the working system can print>
  EVIDENCE: pending

- [ ] G2: <the failure path is handled, not just the happy path>
  CHECK: <command that triggers the failure and observes the handling>
  EXPECT: <the handled-failure signal>
  EVIDENCE: pending

## The change did not break what already worked

- [ ] R1: the existing test suite passes
  CHECK: <your test command>
  EXPECT: <the pass line your runner prints, with counts if it prints them>
  EVIDENCE: pending

- [ ] R2: the project builds from clean
  CHECK: <your build command>
  EXPECT: <the success line your build prints>
  EVIDENCE: pending

## The ledger itself is honest

- [ ] L1: no gate in this file is closed by a check that cannot fail
  CHECK: node bin/receipts.mjs lint GATES.md
  EXPECT: PROOF OK
  EVIDENCE: pending

## Outcomes only a person can close

Attested gates are never counted as proven. They are counted separately and
they always name someone, because an unnamed sign-off is not a sign-off.

- [ ] H1: <the judgement call no command can make>
  ATTEST: <name> <name@company.com> on <YYYY-MM-DD>
