# Changelog

All notable changes to this project are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning is
[semantic](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `check` re-runs gates that are already ticked. It used to skip them, so a
  gate proven against an older version of the system kept its tick and its
  stale evidence line was reported as the current result. Running the project's
  own ledger is what surfaced this: the page validator went from 15 checks to
  29 and gate L2 still reported proven. `--cached` restores the old skipping
  for local speed, announces every gate it skipped and the date of the evidence
  it is trusting, and cannot report success.
- A gate that could not be executed is no longer counted as met. A ledger of
  ticked boxes whose commands were never approved previously printed
  `ALL MET` and exited 0 without running anything, which is the failure this
  project exists to catch. Such a run now prints `NOT VERIFIED`, names the
  gates, and exits 1 whatever the boxes on disk say.
- The site validator sweeps every text file for non-ASCII characters, not just
  HTML and CSS. A smart quote in an SVG `aria-label` used to ship.

### Added

- `GATES.md` gates G4 and G5, covering the two behaviours above.
- `site/404.html`, so a mistyped path lands on something that points at the
  ledger rather than on the default GitHub page.

### Changed

- `--reverify` is gone. Re-running is the default, so the flag it replaced no
  longer had anything to turn on.

Not yet validated against a live Copilot Studio tenant. Every probe is covered
by an offline fixture, and the Dataverse shapes those fixtures encode were read
from documentation and from observed exports rather than from a recorded run in
a real environment. Until that run exists and is published, treat the Copilot
Studio probes as tested but not field-proven, and note that the landing page
says the same thing rather than implying otherwise.

## [0.1.0] - 2026-08-30

First working version.

### Added

- A ledger format where an outcome is closed by a command, not by a claim.
  Five states: open, proven, attested, self-reported, abandoned. Documented in
  `docs/gates-format.md`.
- `receipts status`, `check`, `probe`, `lint`, `init`, and `report`.
- Eight probes for Microsoft Copilot Studio, including `skill-deployed`, which
  catches a deploy that reports success and creates no component.
- Seven lint rules that flag a gate closed by a check that cannot fail, such as
  a grep for a string the agent itself just wrote.
- Command approval that binds to the exact command text, the gate id, and the
  repository path, with the store held outside the repository.
- Two ledger templates: `copilot-studio` and `generic`.
- 35 tests, no network required.
- Documentation: gate format, Copilot Studio specifics, security model, and
  `docs/sources.md`, which carries every external claim with its date plus a
  list of claims that could not be verified and were therefore not made.
- A landing page under `site/`, generated from `tools/index.template.html` and
  `site/fill.py`, validated by `site/validate.py`.
- CI on Node 20, 22, and 24. Separate jobs assert zero runtime dependencies,
  zero write calls in any probe, and that the committed landing page still
  matches its generator.

### Notes on the central rule

A ticked box whose evidence line still reads `pending` is reported as UNMET and
labelled self-reported. This is the whole point of the project and it is the
first behaviour to check if you are evaluating whether to use it. It lives in
`classify()` in `src/ledger.mjs` and is covered by tests.
