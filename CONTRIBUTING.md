# Contributing

## The one rule that matters

This project exists because a checkbox can lie. Do not open a pull request whose
description claims something you have not run.

If you write "tests pass", paste the last line of `node tests/run.mjs`. If you
write "the probe works against a real environment", say which environment and
what it printed. If you could not check something, write that instead. An
honest gap is reviewable. A confident guess is not.

The repository holds itself to this: `GATES.md` at the root is a real ledger,
and `receipts status` is expected to exit 0 before a release.

## Getting set up

There is nothing to install.

```
git clone https://github.com/RagnarPitla/Agent-Receipts.git
cd Agent-Receipts
node tests/run.mjs
```

Node 20 or newer. Zero runtime dependencies, and CI fails if any appear. If you
need a package to add a feature, open an issue first and make the case, because
that is a change to what the project is, not just what it does.

## Before you open a pull request

```
node tests/run.mjs            # must print "N passed, 0 failed"
node bin/receipts.mjs --help  # must exit 0
python3 site/validate.py site # only if you touched site/
```

If you touched anything under `src/probes/`, this must print nothing:

```
grep -rniE "method:[[:space:]]*'(POST|PATCH|PUT|DELETE)'|\.(post|patch|put|delete)\(" src/probes/
```

Probes read. They never write. The landing page and `docs/security.md` both
make that promise to people who are deciding whether to point this at a tenant,
so CI enforces it and a pull request that breaks it will not merge.

## Adding a probe

A probe answers one question about a real system and returns a verdict a
reviewer can argue with. Put it in `src/probes/`, export it from
`src/probes/index.mjs`, and give it a fixture in `tests/fixtures/` so the test
suite can exercise the failing path without a network.

The failing path is the important one. A probe that has only ever been seen to
pass is a probe nobody has tested. `tests/fixtures/agent-push-trap.json` is the
model to copy: it captures a real deploy that reported success and created
nothing.

Every probe must work offline via `--fixture`. That is not a convenience, it is
how the tests stay runnable by someone who does not have a tenant.

## Adding a lint rule

`src/lint.mjs` holds rules that flag a gate closed by a check that cannot fail.
Each rule needs an `id`, a pattern, and a message that says what to write
instead. Add a passing case and a failing case to `tests/run.mjs`.

Be conservative. A rule that fires on reasonable gates trains people to ignore
the linter, which is worse than not having the rule.

## Documentation

`docs/sources.md` carries every external claim with its date, and a section for
things that were checked and could not be verified. If you add a claim about
how a Microsoft product behaves, add the citation there in the same pull
request. If you observed the behaviour rather than read it in documentation,
say so in that entry. Both are useful; conflating them is not.

## Style

Plain ASCII in every file, including commit messages and pull request bodies.
No em dashes, no curly quotes, no arrow glyphs, no section signs. They render
badly in terminals and in some GitHub views.

Comment the reasoning, not the syntax. `// increment i` helps nobody;
`// componenttype 9 also holds McpTool, so discriminate on kind` saves the next
person an afternoon.

## Reporting a bug

The most valuable bug report for this project is a case where a probe said MET
and the thing was not actually done. That is a false pass, and it is the only
failure mode that makes the tool worse than useless. Include the ledger, the
probe output, and what was really true.

Second most valuable: a false fail that is annoying enough that you would turn
the check off.
