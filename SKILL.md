---
name: receipts
description: Prove that a Microsoft Copilot Studio agent is actually built and actually deployed, instead of trusting a success message. Use when building, upgrading, reviewing or shipping a Copilot Studio agent, when a push or deploy reported success, when someone asks whether an agent is ready, or when a checklist needs to be closed with evidence rather than opinion.
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
