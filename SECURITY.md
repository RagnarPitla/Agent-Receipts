# Security

## Reporting a vulnerability

Open a private security advisory on the repository:
<https://github.com/RagnarPitla/Agent-Receipts/security/advisories/new>

Do not open a public issue for anything that could be used against someone's
tenant. Expect a first reply within a week. This is a personal open source
project, not a supported Microsoft product, and there is no paid on-call
rotation behind it.

## What this tool does with your credentials and data

Nothing, in the ordinary case. Concretely:

- No runtime dependencies, so no transitive supply chain. CI fails if any
  appear.
- No telemetry. No network call is made except by a probe you explicitly point
  at an environment.
- Probes read and never write. `grep -rniE "method:[[:space:]]*'(POST|PATCH|PUT|DELETE)'|\.(post|patch|put|delete)\(" src/probes/` returns nothing, and CI fails if it stops returning nothing.
- Authentication is delegated to the tools you already trust. This project
  stores no secret of its own.
- Approvals are recorded outside the repository so an approval cannot be
  committed, copied into a fork, or replayed by a pull request.

## The part that deserves your attention

`receipts check` runs shell commands. Those commands come out of `GATES.md`,
and `GATES.md` is often written by an AI agent. That is the sharp edge of this
design, and pretending otherwise would be dishonest.

The mitigations are in `docs/security.md` in full. The short version:

- A command runs only after a human approves that exact command.
- Approval binds to the command text, the gate id, and the repository path. Any
  edit to the command invalidates the approval and it must be granted again.
- The approval store lives outside the repository.
- There is no wildcard approval and no "approve everything" flag, deliberately.

## What this does not defend against

Saying this plainly is more useful than a longer list of what it does defend
against.

- A human who approves a malicious command without reading it. Approval is a
  real decision, not a dialog to dismiss.
- A compromised machine. If an attacker can write to your approval store they
  can approve their own commands.
- A probe pointed at an environment the operator should not have been able to
  read. This tool inherits your permissions; it does not check whether you
  should have them.
- A gate whose check genuinely passes while the underlying work is wrong. The
  linter catches checks that cannot fail. It cannot catch a check that is
  merely a bad question.

## Scope

In scope: anything in this repository. Command approval bypass, evidence
forgery that `status` would not report, a probe that writes, credential
leakage, or a path that lets a repository file escalate into command execution
without approval.

Out of scope: vulnerabilities in Microsoft Copilot Studio, the Power Platform
CLI, Dataverse, or GitHub. Report those to the respective vendor. Findings that
require an already-compromised machine, and social engineering of a human
approver, are also out of scope.
