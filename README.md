# Agent Receipts

**No receipts, no done.** A proof ledger for Microsoft Copilot Studio.

An AI agent builds your Copilot Studio agent, then tells you it is done. That
message is usually the only evidence you get. Agent Receipts replaces it with a
list of outcomes, each one closed by a command whose output you can read.

Live site: **<https://ragnarpitla.github.io/Agent-Receipts/>**

---

## The two failures this exists for

**A deploy that reports success and creates nothing.**

On the GitHub Copilot harness, `pac copilot push` returns success and silently
creates no component for a new skill. The push log is green. The skill is not on
the agent. Every report written from that log is wrong, and nothing in the
toolchain contradicts it. This is documented in
[build-copilot-studio-agents](https://github.com/RagnarPitla/build-copilot-studio-agents)
as the single most expensive trap on the platform, and it is the reason this
repository exists.

**A checklist the agent filled in itself.**

A ticked box is a claim. If the evidence line under it still says `pending`, the
box records an opinion the agent formed about its own work. That is the same
self-assessment the checklist was meant to replace.

Both fail identically: the only evidence is the agent's account of itself.

## The rule

> A ticked box with `EVIDENCE: pending` counts as **unmet**.
> An empty box is more honest, because it is at least accurate about where the
> work stopped.

Everything else in this repository follows from that line.

## What a gate looks like

```
- [ ] D1: every skill in source control exists on the agent in the environment
  CHECK: receipts probe skill-deployed --path ./skills --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending
```

`receipts check` runs the command, compares the output against `EXPECT:`, and
writes the evidence itself. The agent never writes that line.

A gate closes only when the process exits `0` **and** the expected string appears
in the output. Either one alone is not proof: a command can print a success
banner and exit 1, and a command can exit 0 having done nothing at all.

After a run, that gate reads:

```
- [x] D1: every skill in source control exists on the agent in the environment
  CHECK: receipts probe skill-deployed --path ./skills --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: proven | exit=0 | expect=matched | shell=/bin/sh | cwd=/repo | ms=350 | output=sha256:5c0cb3cbb73c568b bytes=124 | at=2026-08-31T02:03:37.045Z
```

Evidence records the exit status, whether the expectation matched, the resolved
shell and working directory, and a fingerprint of the successful output. The raw
output is never echoed and never stored, so a ledger is safe to commit.

## Gate states

| Box | State | Counts as |
| --- | --- | --- |
| `[ ]` | open | not done |
| `[x]` with real evidence | proven | done, by machine |
| `[x]` with `EVIDENCE: pending` | self-reported | **not done**, and reported as such |
| `[~]` with `ATTEST:` naming a person | attested | done, by a named human, counted separately |
| `[-]` with `REASON:` | abandoned | a handoff. Explicitly not success |

Attested gates are never described as proven. Some outcomes are only true when a
person says so, and pretending a machine established them is the same lie in a
different direction. An attestation that names nobody is rejected.

## The Copilot Studio probes

Eight probes, each printing `PROOF OK` or `PROOF FAIL`. All of them read. None of
them write: a verifier that can change the thing it verifies is not a verifier.

| Probe | Proves |
| --- | --- |
| `skill-deployed` | the skill exists on the agent, not just in the push log |
| `skill-matches` | the deployed bytes equal the reviewed source bytes |
| `no-orphan-skills` | nothing is live that is not in source control |
| `harness` | the agent runs the harness this work assumed |
| `component-count` | components are present, counted by `kind` |
| `instructions-contain` | a required clause is really in the instructions |
| `skill-quality` | each skill answers the seven rubric questions, offline |
| `eval-coverage` | every skill has at least one thing measuring it |

Two targets:

```bash
--env-url <dataverse-url> --bot-id <guid>   # live, reads Dataverse
--fixture <file.json>                        # offline, deterministic, for CI
```

`skill-quality` and `eval-coverage` need no environment and no credentials, so
they run on every commit without a tenant.

Component kinds matter more than component types. Copilot Studio stores skills,
child agents, MCP tools and knowledge under the same `componenttype`, so
`componenttype` alone never identifies a skill. Every probe discriminates on
`kind`.

## Quick start

```bash
git clone https://github.com/RagnarPitla/Agent-Receipts.git
cd Agent-Receipts
node tests/run.mjs            # 37 tests, no network, no credentials
```

In your own project:

```bash
receipts init .                  # writes GATES.md, Copilot Studio preset
$EDITOR GATES.md                  # replace every placeholder
receipts status GATES.md         # reads the ledger, executes nothing
receipts lint GATES.md           # advisory: catches gates that prove nothing
receipts check --approve GATES.md
receipts report GATES.md --out RECEIPTS.md
```

Try it against the shipped fixtures before pointing it at a tenant. This is the
push trap, reproduced offline:

```bash
node bin/receipts.mjs probe skill-deployed \
  --path tests/fixtures/skills/match-exception-explainer \
  --fixture tests/fixtures/agent-push-trap.json
```

```
PROOF FAIL 1 skill(s) named in the ledger are not on the agent
  expected: match-exception-explainer
  on agent: (none)
  MISSING: match-exception-explainer  <- push reported success; the component does not exist
```

## `CHECK:` lines are shell code

Running a command because a Markdown file said so is the same class of mistake
this project exists to prevent. So the first time an exact command is seen, the
checker prints it and refuses to run it:

```
D1  NOT YET APPROVED - printing the oracle instead of running it
  command : receipts probe skill-deployed --path ./skills
  expects : PROOF OK
  cwd     : /repo
  shell   : /bin/sh
  PATH    : bb1a299c0c7a (38 entries)
  Read the command and everything it calls, then re-run with --approve.
```

Approval binds to the exact command, expectation, working directory, shell,
timeout, platform and `PATH`. Change any of them and it needs approving again.
Records live outside the repository, owner-private, so the code being checked
cannot approve itself.

Approval is consent, not a sandbox. Checks run with your filesystem, environment,
credentials and network. `receipts status` is the only mode that never executes
anything.

## Linting a ledger that fools itself

The checker can prove only the oracle you declared. It cannot know whether an
English title and a line of shell mean the same thing. `receipts lint` catches
the mechanical shapes that pass while proving nothing:

```
W1  echo-oracle: the check only prints its own expectation, so it passes whatever the code does
W1  expect-in-check: the expected string is written inside the command, so the command cannot fail the match
W2  true-tail: the command swallows its own failure, so exit 0 is guaranteed
W3  no-assertion: listing or printing a file shows it exists, not that it is correct
W4  attest-unnamed: the attestation does not name a person, so nobody is accountable for it
```

Advisory by default. `--strict` makes findings fail the run.

A good gate reads the artifact named by the outcome, prints a success marker only
after every assertion passes, and measures a figure rather than copying it into
`EXPECT:`.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | every gate is met |
| 1 | something is unproven, or a gate was abandoned |
| 2 | the ledger itself is invalid, and therefore proves nothing |

A ledger with zero gates, a duplicate gate id, a `CHECK:` with no `EXPECT:`, or
an abandonment with no reason all exit 2. A ledger that cannot be trusted is not
allowed to report success.

## Where this sits

| Repository | Does |
| --- | --- |
| [Agent Spark](https://github.com/RagnarPitla/Agent-Spark) | scaffolds a Copilot Studio agent from a scenario template |
| [build-copilot-studio-agents](https://github.com/RagnarPitla/build-copilot-studio-agents) | upgrades a classic agent to the GitHub Copilot harness, with skills |
| **Agent Receipts** | proves the result is real before anyone ships it |

Agent Receipts installs into a coding agent as a skill, so Claude Code, GitHub
Copilot CLI and Codex all read the same rules. `SKILL.md` uses the format the
Copilot Studio GitHub Copilot harness also accepts.

It is also a valid Agent Spark skill, and that is checked rather than assumed.
Copy `SKILL.md` to `skills/receipts/SKILL.md` in an Agent Spark checkout and run
that repository's own validator:

```
$ node scripts/validate.mjs
  schema             pass
  references         pass
  secrets            pass
  ascii              pass
PASSED.
```

The frontmatter carries every field `schemas/skill.schema.json` requires,
including `useWhen`, `doNotUseWhen`, `outputs` and `guardrails`. Keep the
description under 300 characters, which is the limit that validator enforces.

## Roadmap

Copilot Studio is built and tested. The other two surfaces are on the roadmap and
nothing here talks to them yet. They are listed so the direction is clear, not to
imply working support.

| Surface | State |
| --- | --- |
| Microsoft Copilot Studio | built, eight probes, live and offline modes |
| [Microsoft Cowork](https://www.microsoft.com/en-us/microsoft-365/blog/2026/03/09/copilot-cowork-a-new-way-of-getting-work-done/) | planned, not built |
| [Microsoft Scout](https://learn.microsoft.com/en-us/microsoft-scout/get-started) | planned, not built |

## Support boundary

Agent Receipts is an unofficial community project. It is not a Microsoft
product, is not covered by Microsoft Support, and does not reimplement the
Copilot Studio runtime, harness or orchestration engine. It calls only public,
documented interfaces, reads only, and never bypasses tenant administration,
environment policy, DLP, authentication, licensing, consent or approval. Where a
policy blocks a read, it reports that. It does not route around it.

## Status

| Area | State |
| --- | --- |
| ledger engine | working. Parse, evidence, approval, re-run, atomic writes |
| eight Copilot Studio probes | working, live and offline |
| `lint` | working, seven rules, advisory or strict |
| `report` | working, Markdown for a pull request |
| tests | 35, deterministic, no network |
| Cowork and Scout adapters | not started |

Node 20 or newer. Zero runtime dependencies, and CI fails if any appear.

## This repository runs its own ledger

`GATES.md` at the root is real, not a sample. Fourteen outcomes, twelve of
them closed by a command whose output is recorded in the file:

```
$ receipts check GATES.md --approve

  proven 12   attested 0   open 2   self-reported 0   abandoned 0   of 14

  NOT MET
```

The run exits 1, and it should. Two gates are open:

**E1: the probes have been run against a live Copilot Studio environment and
the transcript published.** Every probe is covered by an offline fixture, and
those fixtures encode Dataverse shapes read from documentation and from
observed exports. No run against a live tenant has been recorded and published
yet. Ticking E1 before that happens would be the exact failure this project
exists to catch, so it stays open and this README says so.

**H1: the framing is fair to the platform teams whose work this sits beside.**
That is a judgement, not a command. It is an attestation gate and it needs a
name against it.

Read the file, then run it yourself:

```
node bin/receipts.mjs status GATES.md   # reads only, executes nothing
node bin/receipts.mjs check  GATES.md   # prints each command for approval
```

## Contributing

Full guide in [CONTRIBUTING.md](CONTRIBUTING.md). The short version: behavioural
claims need a current source that directly supports them, executable changes
need a regression test, and Markdown must be ASCII, because em dashes, smart
quotes, arrows and dingbats render as mojibake in the GitHub UI.

Do not open a pull request whose description claims something you have not run.

Security policy and the threat model are in [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE).

Views expressed here are my own and do not represent Microsoft's official
position.
