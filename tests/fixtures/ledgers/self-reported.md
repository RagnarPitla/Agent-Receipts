# Proof ledger: self-report fixture

A fixture, not a real ledger. It exists so the test suite and this project's own
GATES.md can demonstrate the central rule against a file that never changes:

  a ticked box whose EVIDENCE still reads `pending` is reported as UNMET.

A1 below is ticked and has no evidence. `status` must count it as self-reported,
must not count it as proven, and must exit 1. If it ever exits 0, the tool is
decorative.

- [x] A1: the work is finished
  CHECK: node -e "process.stdout.write('finished')"
  EXPECT: finished
  EVIDENCE: pending

- [ ] A2: the work is reviewed
  CHECK: node -e "process.stdout.write('reviewed')"
  EXPECT: reviewed
  EVIDENCE: pending
