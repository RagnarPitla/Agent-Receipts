# The Copilot Studio playbook

## Why this surface first

Copilot Studio is where the gap between "the agent reported success" and "the
agent works" is widest right now, for three reasons that are all documented.

**One. The platform's own evaluation cannot check a specific answer.** On the
GitHub Copilot harness, General quality is the only test method available, and
Microsoft states it "doesn't compare responses to expected answers." It scores
Relevance, Groundedness, Completeness and Abstention, and if one criterion is
not met the response is flagged for improvement. That is a useful signal about
tone and grounding. It is not a check that your match-exception skill returns
the right exception. Nothing in the product closes that gap, which is the gap
this tool sits in.

Source: [agent evaluation intro](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/analytics-agent-evaluation-intro),
[evaluation overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-agent-evaluation-overview)

**Two. Microsoft does not validate custom skills.** That sentence appears in
the documentation for Copilot Studio's sibling surfaces verbatim: "Microsoft
doesn't validate custom skills created by users." The quality of a skill is
entirely the author's problem, and until now the author had no way to
demonstrate that quality to anyone else.

**Three. The harness bills from build time.** The GitHub Copilot harness
charges credits from the moment you start building, and previewing, testing
and generating evaluations all consume Copilot Credits. Work that is redone
because nobody checked it the first time is not just late, it is billed twice.

Source: [billing overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/billing-credit-overview)

## The trap this was built for

`pac copilot push` reports success and creates nothing when the skill is new.

The command is designed to update components that already exist. Point it at a
skill the agent has never seen and it will complete, print a green success
line, and leave the agent exactly as it was. The log is truthful about what the
command did. It is silent about what you assumed it did.

An agent reading that log has no way to know. It reports the deployment as
done, because from where it is standing the deployment is done. The skill is
not on the agent, the evaluation runs against an agent that never changed, and
the result looks like a modelling problem rather than a deployment problem.

This is the single most expensive trap in Copilot Studio skill work, and it is
one probe away from being impossible:

```
- [ ] D1: every skill in source control exists on the agent in the environment
  CHECK: node bin/receipts.mjs probe skill-deployed --path ./skills --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending
```

The probe reads the agent's components out of Dataverse and compares them to
what is on disk. It does not read the deployment log, because the deployment
log is the thing that lied.

You can see it fail without a tenant:

```
node bin/receipts.mjs probe skill-deployed --path ./skills \
  --fixture tests/fixtures/agent-push-trap.json
```

## How skills are actually stored

A skill is a `botcomponent` row with `componenttype = 9`:

```
schemaname = <botschemaname>.skill.<skill-name>_<3 chars>   # max 100 chars
data       = "kind: InlineAgentSkill\ncontent: |\n  <SKILL.md indented by 2>"
```

The important detail, and the one that breaks naive tooling: **`componenttype`
9 is not exclusively skills.** It also holds `AgentDialog` (child agents),
`McpTool`, `TaskDialog` and `KnowledgeSourceConfiguration`. Counting type 9
rows and calling the number "skills" gives an answer that is wrong on every
real agent. Always discriminate on the `kind` inside `data`. Every probe here
does.

This layout is observed from a live environment rather than published by
Microsoft, so treat it as something to verify rather than a contract.

## Harness detection

| Recognizer in the bot configuration | Harness | Skills |
|---|---|---|
| `CLICopilotRecognizer` | GitHub Copilot | yes |
| `GenerativeAIRecognizer` | standard | no |

Neither name is documented on Microsoft Learn. `CLICopilotRecognizer` appears
in first-party test data; `GenerativeAIRecognizer` only in community tooling.
So the `harness` probe returns `unknown` when it sees neither, and an unknown
harness fails the gate rather than being assumed correct.

Deploying skills to an agent on the standard harness fails in a way that looks
like a permissions problem for about an hour. Checking the harness first costs
nothing.

Note the casing. It is `CLICopilotRecognizer` with three capitals, the CLI flag
is `--authoring-mode cli-copilot`, and the scaffolded shape is `CliCopilot`.
Three spellings of one idea.

## The eight probes

| Probe | The question it answers |
|---|---|
| `skill-deployed` | Is every skill in source control actually on the agent? |
| `skill-matches` | Are the deployed bytes the same as the bytes that were reviewed? |
| `no-orphan-skills` | Is anything live that nobody has reviewed? |
| `harness` | Is this agent on the harness the work assumed? |
| `skill-quality` | Does each skill answer the seven questions a skill must answer? |
| `eval-coverage` | Is every skill covered by at least one evaluation case? |
| `component-count` | Does the agent have the knowledge, tools or topics it needs? |
| `instructions-contain` | Do the instructions actually say the thing you promised they say? |

All eight are read-only. They issue `GET` requests against the Dataverse Web
API and nothing else. There is no code path that writes.

Every probe takes `--fixture <file>` and reads a JSON file instead of a
tenant, so you can develop and test against realistic component payloads with
no environment, no credentials and no network.

## Setting up

```bash
pac auth create --environment https://<org>.crm.dynamics.com
export MCS_ENV_URL=https://<org>.crm.dynamics.com
export MCS_BOT_ID=<the bot guid>
```

The GUID in a Copilot Studio URL is the **environment** id, not the Dataverse
organisation URL and not the bot id. Resolve it with `pac env list`. Confusing
the two produces a 404 that reads like a permissions error.

## The seven questions a skill must answer

`skill-quality` checks that each `SKILL.md` states:

1. When to invoke it, in words that distinguish it from every other skill
2. What inputs it needs, and what to do when one is missing
3. The steps, in order
4. What it must confirm with a human before doing
5. What it returns
6. What to do when a step fails
7. What it must not do

A skill that scores badly here is not a broken skill. It is a skill that will
behave differently on Tuesday than it did on Monday, and nobody will be able to
explain why.
