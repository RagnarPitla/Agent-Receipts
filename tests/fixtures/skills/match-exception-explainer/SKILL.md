---
name: match-exception-explainer
description: Explain why a bank statement line did not auto-match and what to do next.
---

# Match exception explainer

## When to use this skill
Use this skill when a user asks why a bank statement line did not match.

## Required inputs
- statement line id
- bank account

If the user has not provided a statement line id, ask for it before continuing.

## Steps
1. Read the statement line.
2. Compare against open ledger transactions.
3. Classify the no-match reason.

## Confirmation
Never post or modify a transaction. Confirm with the user before proposing any change.

## Output
Return the reason, the evidence considered, and the recommended next action.

## On failure
If the statement line cannot be read, say so plainly and escalate to the bank reconciliation owner.
