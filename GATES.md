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

- [x] G1: a ticked box with no evidence is counted as unmet, not as done
  CHECK: out=$(node bin/receipts.mjs status tests/fixtures/ledgers/self-reported.md); rc=$?; printf '%s' "$out"; test $rc -eq 1
  EXPECT: self-reported 1
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=180 | output=sha256:f335cf77bbc40fcc bytes=332 | at=2026-08-31T03:42:18.233Z

- [x] G2: a deploy that reports success and creates nothing is caught
  CHECK: out=$(node bin/receipts.mjs probe skill-deployed --path tests/fixtures/skills --fixture tests/fixtures/agent-push-trap.json 2>&1); rc=$?; printf '%s' "$out"; test $rc -eq 1
  EXPECT: push reported success; the component does not exist
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=411 | output=sha256:59d0ce2653fc94be bytes=302 | at=2026-08-31T03:42:18.646Z

- [x] G3: every shape of a check that cannot fail is still flagged
  CHECK: node bin/receipts.mjs lint tests/fixtures/ledgers/weak-checks.md 2>&1 | grep advisory
  EXPECT: 8 advisory finding(s)
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=57 | output=sha256:333b71a6521089e2 bytes=24 | at=2026-08-31T03:42:18.704Z

- [x] G4: a gate that is already ticked is re-run, so a stale pass cannot survive
  CHECK: d=$(mktemp -d); printf -- '- [x] A1: stale\n  CHECK: printf %s WRONG\n  EXPECT: PROOF OK\n  EVIDENCE: forged\n' > $d/G.md; node bin/receipts.mjs check --approve $d/G.md >/dev/null 2>&1; grep '^- \[ \]' $d/G.md; rm -rf $d
  EXPECT: - [ ] A1: stale
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=88 | output=sha256:0d92746880a2710c bytes=16 | at=2026-08-31T03:42:18.793Z

- [x] G5: a gate that could not be run is never reported as met
  CHECK: d=$(mktemp -d); printf -- '- [x] A1: claimed\n  CHECK: printf %s WRONG\n  EXPECT: PROOF OK\n  EVIDENCE: forged\n' > $d/G.md; node bin/receipts.mjs check $d/G.md 2>&1 | grep 'NOT VERIFIED'; rm -rf $d
  EXPECT: NOT VERIFIED - 1 gate(s) did not run
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=55 | output=sha256:f267c991db7a921d bytes=43 | at=2026-08-31T03:42:18.849Z

## The change did not break what already worked

- [x] R1: the test suite passes
  CHECK: node tests/run.mjs 2>&1 | grep 'passed,'
  EXPECT: 37 passed, 0 failed
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=756 | output=sha256:be64a1ff858e9c6c bytes=20 | at=2026-08-31T03:42:19.606Z

- [ ] R2: it works from a clean clone with nothing installed
  CHECK: rm -rf /tmp/receipts-clean && git clone -q . /tmp/receipts-clean && cd /tmp/receipts-clean && node tests/run.mjs 2>&1 | grep 'passed,'
  EXPECT: 37 passed, 0 failed
  EVIDENCE: pending (last attempt: FAILED | exit=0 | expect=not found | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=943 | at=2026-08-31T03:42:20.549Z)

## The promises made to anyone pointing this at a tenant

These three are on the landing page and in SECURITY.md. They are checked here so
they cannot quietly stop being true.

- [x] S1: no probe can write to an environment
  CHECK: grep -rcniE "method:[[:space:]]*'(POST|PATCH|PUT|DELETE)'|\.(post|patch|put|delete)\(" src/probes/*.mjs | tr '\n' ' '
  EXPECT: dataverse.mjs:0 src/probes/index.mjs:0
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=15 | output=sha256:ad4f35cecc877748 bytes=50 | at=2026-08-31T03:42:20.565Z

- [x] S2: there is no runtime dependency tree to audit
  CHECK: node -e "const d=Object.keys(require('./package.json').dependencies||{}); console.log(d.length+' runtime dependencies: ['+d.join(',')+']')"
  EXPECT: 0 runtime dependencies: []
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=27 | output=sha256:12a5d2f7f8b9c13f bytes=27 | at=2026-08-31T03:42:20.594Z

- [x] S3: an approval store inside the repository is refused
  CHECK: RECEIPTS_APPROVAL_DIR=./tmp-approvals node -e "import('./src/approval.mjs').then(m=>{try{m.approvalDir();console.log('store accepted')}catch(e){console.log(e.message)}})"; rm -rf ./tmp-approvals
  EXPECT: resolves inside the working repository
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=36 | output=sha256:61311f99ca066890 bytes=229 | at=2026-08-31T03:42:20.631Z

## The ledger and the published page are honest

- [x] L1: no gate in this file is closed by a check that cannot fail
  CHECK: node bin/receipts.mjs lint GATES.md 2>&1 | grep 'no weak patterns'
  EXPECT: no weak patterns found
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=33 | output=sha256:8bb92e131a1176b4 bytes=25 | at=2026-08-31T03:42:20.664Z

- [x] L2: the published page is valid and still matches its generator
  CHECK: cp site/index.html /tmp/committed.html && python3 site/fill.py >/dev/null && diff -q /tmp/committed.html site/index.html && python3 site/validate.py site 2>&1 | tail -1
  EXPECT: All 29 checks passed.
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=166 | output=sha256:19348f13756faa7e bytes=22 | at=2026-08-31T03:42:20.830Z

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
  EVIDENCE: pending (last attempt: FAILED | exit=2 | expect=not found | shell=/bin/sh | cwd=/Users/ragnarpitla/Desktop/rbuild-ai/CS-2026/Agent-Receipts | path=bb1a299c0c7a (38 entries) | ms=9 | at=2026-08-31T03:42:20.840Z)

## Outcomes only a person can close

Attested gates are never counted as proven. They are counted separately, and
they always name someone, because an unnamed sign-off is not a sign-off.

- [ ] H1: the framing is fair to the platform teams whose work this sits beside
  ATTEST: Ragnar Pitla <@RagnarPitla> on <unsigned>
