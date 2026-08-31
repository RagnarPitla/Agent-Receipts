# Proof ledger: Agent Receipts

This is the project's own ledger, not an example. Every EVIDENCE line below was
written by `node bin/receipts.mjs check GATES.md`, not typed by hand.

It is here for one reason: a tool that asks you to prove your work should be
able to show its own receipts. If a gate below is open, that is the honest state
of the project, not an oversight to be tidied away before release.

Run it yourself:

    node bin/receipts.mjs status GATES.md     # reads only, executes nothing
    node bin/receipts.mjs check  GATES.md     # prints each command for approval
    node bin/receipts.mjs check  GATES.md --approve

## The tool does the thing it claims to do

- [ ] G1: a ticked box with no evidence is counted as unmet, not as done
  CHECK: out=$(node bin/receipts.mjs status tests/fixtures/ledgers/self-reported.md); rc=$?; printf '%s' "$out"; test $rc -eq 1
  EXPECT: self-reported 1
  EVIDENCE: pending

- [ ] G2: a deploy that reports success and creates nothing is caught
  CHECK: out=$(node bin/receipts.mjs probe skill-deployed --path tests/fixtures/skills --fixture tests/fixtures/agent-push-trap.json 2>&1); rc=$?; printf '%s' "$out"; test $rc -eq 1
  EXPECT: push reported success; the component does not exist
  EVIDENCE: pending

- [ ] G3: every shape of a check that cannot fail is still flagged
  CHECK: node bin/receipts.mjs lint tests/fixtures/ledgers/weak-checks.md 2>&1 | grep advisory
  EXPECT: 8 advisory finding(s)
  EVIDENCE: pending

## The change did not break what already worked

- [ ] R1: the test suite passes
  CHECK: node tests/run.mjs 2>&1 | tail -1
  EXPECT: 35 passed, 0 failed
  EVIDENCE: pending

- [ ] R2: it works from a clean clone with nothing installed
  CHECK: rm -rf /tmp/receipts-clean && git clone -q . /tmp/receipts-clean && cd /tmp/receipts-clean && node tests/run.mjs 2>&1 | tail -1
  EXPECT: 35 passed, 0 failed
  EVIDENCE: pending

## The promises made to anyone pointing this at a tenant

These three are on the landing page and in SECURITY.md. They are checked here so
they cannot quietly stop being true.

- [ ] S1: no probe can write to an environment
  CHECK: grep -rcniE "method:[[:space:]]*'(POST|PATCH|PUT|DELETE)'|\.(post|patch|put|delete)\(" src/probes/*.mjs | tr '\n' ' '
  EXPECT: dataverse.mjs:0 src/probes/index.mjs:0
  EVIDENCE: pending

- [ ] S2: there is no runtime dependency tree to audit
  CHECK: node -e "const d=Object.keys(require('./package.json').dependencies||{}); console.log(d.length+' runtime dependencies: ['+d.join(',')+']')"
  EXPECT: 0 runtime dependencies: []
  EVIDENCE: pending

- [ ] S3: an approval store inside the repository is refused
  CHECK: RECEIPTS_APPROVAL_DIR=./tmp-approvals node -e "import('./src/approval.mjs').then(m=>{try{m.approvalDir();console.log('store accepted')}catch(e){console.log(e.message)}})"; rm -rf ./tmp-approvals
  EXPECT: resolves inside the working repository
  EVIDENCE: pending

## The ledger and the published page are honest

- [ ] L1: no gate in this file is closed by a check that cannot fail
  CHECK: node bin/receipts.mjs lint GATES.md 2>&1 | grep 'no weak patterns'
  EXPECT: no weak patterns found
  EVIDENCE: pending

- [ ] L2: the published page is valid and still matches its generator
  CHECK: cp site/index.html /tmp/committed.html && python3 site/fill.py >/dev/null && diff -q /tmp/committed.html site/index.html && python3 site/validate.py site 2>&1 | tail -1
  EXPECT: All 15 checks passed.
  EVIDENCE: pending

## Not yet proven

This is the gate that matters most to anyone deciding whether to trust the
Copilot Studio probes, and it is open.

Every probe is covered by an offline fixture, and those fixtures encode
Dataverse shapes taken from documentation and from observed exports. No run
against a live tenant has been recorded and published yet. Leaving this open is
deliberate. Closing it with a self-report would be the exact failure this
project exists to catch.

- [ ] E1: the probes have been run against a live Copilot Studio environment and the transcript published
  CHECK: grep -m1 'PROOF' evidence/live-tenant-run.txt
  EXPECT: PROOF OK
  EVIDENCE: pending

## Outcomes only a person can close

Attested gates are never counted as proven. They are counted separately, and
they always name someone, because an unnamed sign-off is not a sign-off.

- [ ] H1: the framing is fair to the platform teams whose work this sits beside
  ATTEST: Ragnar Pitla <@RagnarPitla> on <unsigned>
