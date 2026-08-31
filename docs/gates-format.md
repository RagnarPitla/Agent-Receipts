# The gates format

A ledger is a Markdown file. It is meant to be read in a pull request by a
person who was not in the room when the work was done.

## A gate

```
- [ ] D1: every skill in source control exists on the agent in the environment
  CHECK: node bin/receipts.mjs probe skill-deployed --path ./skills
  EXPECT: PROOF OK
  EVIDENCE: pending
```

Four parts, and each one has a job.

**The checkbox and the id.** The id is how a human refers to the gate in
review. "D1 is still open" is a sentence someone can say in a stand-up.

**The title.** State an outcome, not a task. "Every skill in source control
exists on the agent" is an outcome. "Deploy the skills" is a task, and a task
is finished the moment you have done it, which is exactly the failure this
tool exists to catch.

**CHECK.** A shell command. It must be able to fail. This is the whole
discipline, and it is where most ledgers go wrong. See "Checks that cannot
fail" below.

**EXPECT.** A substring that must appear in stdout. Exit code 0 alone is not
enough, because far too many commands exit 0 while doing nothing.

**EVIDENCE.** Written by the tool, never by hand. It records what the check
actually printed and when.

## The five states

| Written as | State | Counts as |
|---|---|---|
| `- [ ]` | open | not done |
| `- [x]` with real EVIDENCE | met | proven |
| `- [x]` with `EVIDENCE: pending` | self-reported | **not done** |
| `- [~]` with `ATTEST:` | attested | a named person's word, reported separately |
| `- [-]` with `REASON:` | abandoned | a handoff, and the run exits non-zero |

The third row is the one that matters. A ticked box with no evidence is
reported as unmet and named as self-reported. An empty box is more honest than
a ticked one with nothing behind it, so the tool treats the dishonest version
as worse than the open one.

## Attested gates

Some outcomes cannot be closed by a command. Whether three business journeys
give answers a customer would accept is a judgement. Pretending otherwise by
writing a check that greps a log is worse than admitting it.

```
- [~] H1: a named reviewer has run the three journeys that matter and accepts
      the answers
  ATTEST: Priya Nair priya@contoso.com on 2026-08-14
```

Attested gates are never counted as proven. They are reported on their own
line, and they must name a person and a date. `ATTEST: yes` is rejected,
because a sign-off with nobody's name on it is not a sign-off.

## Abandoned gates

```
- [-] D4: the agent is on the harness this work assumed
  REASON: environment is on the standard harness; skills cannot be deployed
          here at all. Raised with the platform owner on 2026-08-14.
```

Abandonment is legitimate. Silence is not. An abandoned gate makes the run
exit non-zero, so the work cannot be handed over as if it were complete, but
the reason travels with it in the pull request.

## Checks that cannot fail

`receipts lint` looks for seven patterns. Each one is a check that passes
whether or not the outcome is true.

| Rule | What it catches |
|---|---|
| echo-oracle | `echo "PROOF OK"` and friends. The check prints the answer it is graded on. |
| expect-in-check | The EXPECT string appears literally in the CHECK command. |
| true-tail | `... \|\| true`, `; true`, `set +e`. The exit code was thrown away. |
| weak-expect | EXPECT is empty, a single character, or matches almost anything. |
| no-assertion | The command only lists, prints or reads. It observes nothing. |
| self-report | The check asks the agent whether it finished. |
| attest-unnamed | An ATTEST with no name, no address, or no date. |

Lint is advisory. It prints findings and exits 0 unless you pass `--strict`,
which is what you want in CI.

The rules are heuristics and they will miss a determined author. That is fine.
They are not there to stop fraud, they are there to catch the check you wrote
at the end of a long day that quietly always passes.

## Writing a check that is worth having

Observe the running system, not the source that was typed.

```
# Proves the file was written.
CHECK: grep -q "handleRefund" src/skills.ts

# Proves the behaviour exists where it has to exist.
CHECK: node bin/receipts.mjs probe skill-deployed --path ./skills
```

The first passes if someone types a function name into a comment. The second
reads the agent in the environment and fails if the skill never arrived.

Three questions for any check you write:

1. If the outcome were missing, would this command fail? If not, it is decoration.
2. Does the answer come from the system, or from something the agent wrote about
   the system? A log line saying "deployed successfully" is the second kind.
3. Would you accept this as proof from someone whose work you did not trust?
