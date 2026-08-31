# Proof ledger: <agent name>

Every line below is an outcome that must be true before this agent is fit to
ship. Replace every placeholder. Delete gates that do not apply, and add the
ones specific to this agent - a ledger copied unchanged proves nothing about
your agent.

Ticking a box by hand does not close a gate. `receipts check` writes the
evidence, and a ticked box with `EVIDENCE: pending` is reported as unmet.

## Deployment is real, not reported

- [ ] D1: every skill in source control exists on the agent in the environment
  CHECK: node bin/receipts.mjs probe skill-deployed --path ./skills --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending

- [ ] D2: the deployed skill bytes are identical to the reviewed source
  CHECK: node bin/receipts.mjs probe skill-matches --path ./skills --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending

- [ ] D3: nothing is live on the agent that is not in source control
  CHECK: node bin/receipts.mjs probe no-orphan-skills --path ./skills --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending

- [ ] D4: the agent is on the harness this work assumed
  CHECK: node bin/receipts.mjs probe harness --expect github-copilot --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending

## The agent is built well enough to be relied on

- [ ] Q1: every skill states when to invoke it, its inputs, its steps, its
      confirmation rules, its output, and what to do on failure
  CHECK: node bin/receipts.mjs probe skill-quality --path ./skills
  EXPECT: PROOF OK
  EVIDENCE: pending

- [ ] Q2: every skill is covered by at least one evaluation case
  CHECK: node bin/receipts.mjs probe eval-coverage --path ./skills --evals ./evals
  EXPECT: PROOF OK
  EVIDENCE: pending

- [ ] Q3: the agent has knowledge attached, so grounded answers are possible
  CHECK: node bin/receipts.mjs probe component-count --kind KnowledgeSourceConfiguration --min 1 --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending

- [ ] Q4: the instructions forbid the agent taking a side effect without asking
  CHECK: node bin/receipts.mjs probe instructions-contain --text "confirm" --env-url $MCS_ENV_URL --bot-id $MCS_BOT_ID
  EXPECT: PROOF OK
  EVIDENCE: pending

## Outcomes only a person can close

Attested gates are never counted as proven. They are counted separately and
they always name someone, because an unnamed sign-off is not a sign-off.

- [ ] H1: a named reviewer has run the three journeys that matter to the
      business and accepts the answers
  ATTEST: <name> <name@company.com> on <YYYY-MM-DD>

- [ ] H2: the environment's DLP policy and the connectors this agent uses have
      been checked together by someone who owns that policy
  ATTEST: <name> <name@company.com> on <YYYY-MM-DD>
