---
name: receipts
description: Prove a Microsoft Copilot Studio agent is actually built and actually deployed rather than trusting a success message. Use when a push or deploy reported success, when someone asks if an agent is ready to publish, or when a checklist is being ticked faster than it is being checked.
version: 0.1.0
owner: "@RagnarPitla"
license: MIT
provenance: Original work. The ledger format, the probes and the lint rules were written for this repository. Behaviour of Microsoft products is cited in docs/sources.md with the date it was checked, and claims that could not be verified are listed there and are not made.
maturity: experimental
reviewBy: "2026-11-30"
useWhen:
  - A Copilot Studio agent is about to be called done, published or handed over.
  - A push or deploy reported success and nobody has read the result back from the environment.
  - A reviewer is deciding whether an agent is fit to publish.
  - A long build session is ending and a completion report is about to be written.
  - A checklist exists and the boxes are being ticked faster than they are being checked.
doNotUseWhen:
  - The change is one line and its result is already visible. The ledger costs attention.
  - There is no environment to read back from and no command that could fail.
  - Someone wants a green summary rather than an accurate one. This skill will not produce one.
  - The request is to fix the agent. This reports what is true; it does not repair.
inputs:
  - name: ledgerPath
    type: string
    required: false
    description: Path to the GATES.md ledger. Defaults to GATES.md in the repository root.
  - name: environmentUrl
    type: string
    required: false
    description: Dataverse environment URL for the live probes. Omit to run offline against a fixture.
    sensitive: false
  - name: botId
    type: string
    required: false
    description: The bot GUID to probe. Required with environmentUrl.
tools:
  - name: receipts
    access: read
    requiresConfirmation: false
    description: Reads and writes the ledger file. Never contacts an environment on its own.
  - name: dataverse
    access: read
    requiresConfirmation: false
    description: Reads botcomponent rows to check what is actually on the agent. No probe issues a write.
  - name: shell
    access: read-write
    requiresConfirmation: true
    description: Runs the CHECK command of a gate. Every command must be approved once by a human before it runs, and the approval binds to the exact command text.
outputs:
  - name: ledger
    description: The updated GATES.md, where each closed gate carries the exit code, the matched expectation, a hash of the output and a timestamp.
    required: true
  - name: verdict
    description: MET or NOT MET, with counts for proven, attested, open, self-reported and abandoned. Exit 1 when anything is unproven.
    required: true
  - name: report
    description: A Markdown table for a pull request body, listing every gate and the evidence behind it.
    required: false
guardrails:
  - Never tick a box the tool did not close. A ticked box whose evidence reads pending is reported as unmet and named as self-reported.
  - Never run a CHECK command that a human has not approved. Approval binds to the exact command text, the gate id and the repository path, and any edit invalidates it.
  - Never write to a Copilot Studio environment. Probes read only.
  - Never report a gate as proven on the basis of a deploy log. Read the state back from the environment.
  - Never invent an expectation that the command cannot fail to produce. If no command can decide the outcome, mark it as an attestation and name the person.
  - State an unverifiable claim as unverified rather than omitting it or asserting it.
compatibility:
  harness:
    - github-copilot
    - standard
  verified: false
---

# Receipts

An agent does not get to mark its own homework.

This skill replaces "I have finished" with a ledger of outcomes, each one closed
by a command whose output you can read. It is built for Microsoft Copilot Studio
first, because that platform has a specific and expensive version of the
problem.

## When to use this skill

Use it when any of these is true:

- You are building or upgrading a Copilot Studio agent and are about to say it is done.
- A `pac copilot push` or any deploy reported success and nobody has read the result back.
- Someone is deciding whether an agent is fit to publish.
- A review needs evidence rather than a summary.
- A long session is ending and you are about to write a completion report.

Do not use it for a one-line change with an obvious result. The ledger costs
attention, and spending attention on something already visible wastes it.

## The two failures this exists for

**A deploy that reports success and creates nothing.** On the GitHub Copilot
harness, `pac copilot push` returns success and silently creates no component
for a new skill. The push log is green. The skill is not on the agent. Any
report written from that log is wrong, and nothing in the toolchain says so.

**A checklist the agent filled in itself.** A ticked box is a claim. If the
evidence line under it still reads `pending`, the box records an opinion the
agent formed about its own work. That is the same self-assessment the checklist
was supposed to replace.

Both fail the same way: the only evidence is the agent's own account of itself.

## The rule

> A ticked box with `EVIDENCE: pending` counts as **unmet**.
> An empty box is more honest, because it is at least accurate about where the
> work stopped.

## How to work

### 1. Write the ledger before doing the work

```bash
receipts init .                      # Copilot Studio preset
receipts init . --preset generic     # any other project
```

Then edit `GATES.md`. Each gate is one outcome that must be true, plus the
command that proves it:

```
- [ ] D1: every skill in source control exists on the agent in the environment
  CHECK: receipts probe skill-deployed --path ./skills --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending
```

Write the gates from the outcomes the user asked for, not from the components
you plan to build. "The agent answers a reconciliation question with a citation"
is an outcome. "A skill file exists" is a file.

A ledger copied from the template unchanged proves nothing about this agent.
Delete gates that do not apply and add the ones that do.

### 2. Read the ledger without running it

```bash
receipts status GATES.md
```

`status` never executes anything. Use it to see where the work actually is, and
to catch a self-reported tick before it reaches a report.

### 3. Do the work

Build the agent. Author the skills. Push to draft. Nothing here changes how you
build; it changes what counts as finished.

### 4. Close the gates with evidence

`CHECK:` lines are shell code. The first time an exact command is seen, the
checker prints it and does not run it. Read the command and everything it calls,
then approve:

```bash
receipts check GATES.md              # prints unapproved oracles, runs nothing
receipts check --approve GATES.md    # runs them and writes evidence
receipts check --reverify GATES.md   # re-runs gates already marked proven
```

A gate closes only when the process exits 0 **and** the `EXPECT:` string appears
in the output. Either alone is not proof: a command can print a success banner
and exit 1, and a command can exit 0 having done nothing.

When a check fails, the tick is removed. The tool will not leave a false one
behind.

### 5. Check the ledger is not fooling itself

```bash
receipts lint GATES.md
```

The checker can only prove the oracle you declared. It cannot know whether an
English title and a line of shell mean the same thing. `lint` catches the
mechanical shapes that pass while proving nothing: an `echo` that prints its own
expectation, a `|| true` that swallows failure, an expectation written inside its
own command, an attestation that names nobody.

### 6. Hand back with the report, not with a summary

```bash
receipts report GATES.md --out RECEIPTS.md
```

Paste it into the pull request or the handover. It states how many outcomes were
proven by machine, how many were attested by a named human, how many are open,
and how many were abandoned.

## The Copilot Studio probes

Every probe prints `PROOF OK` or `PROOF FAIL` and exits accordingly. All of them
read; none of them write. A verifier that can change the thing it verifies is
not a verifier.

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

Targets:

```bash
--env-url <dataverse-url> --bot-id <guid>   # live
--fixture <file.json>                        # offline, deterministic, for CI
```

The environment GUID in a Copilot Studio URL is not the Dataverse URL. Resolve
it with `pac env list` and take the Dataverse URL from the matching row.

`skill-quality` and `eval-coverage` need no environment and no credentials, so
they run in CI on every commit.

## Outcomes a machine cannot close

Some things are only true when a person says so. Those get an attested gate:

```
- [~] H1: a named reviewer ran the three journeys that matter and accepts the answers
  ATTEST: Ragnar Pitla <ragnar@example.com> on 2026-08-30
```

Attested gates are counted separately from proven ones and are never described
as proven. An attestation that names nobody is rejected by `lint`, because an
unnamed sign-off is not a sign-off.

## When a gate cannot be closed

Say so on the record rather than dropping it:

```
- [-] D5: the legacy connector is covered by a regression case
  REASON: the connector is retired in this tenant and the endpoint returns 410
```

Abandonment is a handoff, not a pass. The run reports `HANDOFF REQUIRED` and
exits non-zero. A gate abandoned inside a task can never promote that task to
complete.

## Reporting rules

- Never write that something works when you did not run its check.
- Name what you did not verify, plainly, in the same place you report what you did.
- `ALL MET` comes from the tool. Do not write it yourself.
- If the ledger says `NOT MET`, the work is not finished, whatever the session feels like.

## Publishing

Pushing to draft is expected. Publishing makes the agent live for everyone it is
shared with. Never publish without explicit approval, and never treat a green
ledger as that approval.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | every gate is met |
| 1 | something is unproven, or a gate was abandoned |
| 2 | the ledger itself is invalid and proves nothing |
