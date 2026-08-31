# Sources

Every factual claim in this repository traces to something on this page. If a
claim is not here, treat it as opinion.

Read on 2026-08-30. Where a Microsoft Learn page carries an `ms.date`, it is
given, because these pages move.

## The gap this project sits in

**Copilot Studio's General quality does not compare answers to expected
answers.** On the GitHub Copilot harness it is the only test method available.
It scores Relevance, Groundedness, Completeness and Abstention, and flags a
response if any one criterion is not met.
[agent evaluation intro](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/analytics-agent-evaluation-intro),
[evaluation overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-agent-evaluation-overview)

**Microsoft does not validate custom skills.** Stated verbatim in the Scout and
Cowork FAQs: "Microsoft doesn't validate custom skills created by users."
[Scout FAQ](https://learn.microsoft.com/en-us/microsoft-scout/faq),
[Cowork FAQ](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-faq)

**The GitHub Copilot harness bills from build time.** It "charges credits from
the moment you start building", and previewing, testing and generating
evaluations all consume Copilot Credits.
[billing overview](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/billing-credit-overview)

**Microsoft has already named this failure mode, on a different product.**
Azure AI Foundry ships a `Task Completion` evaluator: "Measures if the agent
completed the requested task with a usable deliverable that meets all user
requirements." It ships `Response Completeness` for "not missing critical
information". Microsoft describes agent evaluators as "unit tests for agentic
systems".

This is the honest version of the argument for this project. The idea is not
new and Microsoft did not miss it. Those evaluators live in Foundry, run
offline, and need a judge model deployment and an SDK. They are not available
inside a Copilot Studio agent on the GitHub Copilot harness, inside Cowork, or
inside Scout, which is where the work actually runs.
[agent evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/agent-evaluators)
(`ms.date: 2026-08-26`),
[built-in evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/built-in-evaluators)
(`ms.date: 2026-06-02`)

Note the URL. `learn.microsoft.com/en-us/azure/ai-foundry/...` now redirects to
`/azure/foundry/...`. Link to the destination.

## Agents stop early: the measurements

**A green test suite and finished work are different things.** METR, 12 August
2025, gave an agent 18 real issues from `stdlib-js` and `hypothesis`. It scored
**38% (+/-19%)** against maintainer-written tests. On manual review, **none of
the 15 PRs examined were mergeable as-is**. Even PRs that passed every
human-written test needed **26 minutes** of human fix-up on average. METR's own
conclusion: "algorithmic scoring based on unit tests overestimates model
capabilities."
[METR, 2025-08-12](https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons/)

This is the single best citation for the thesis. Three of the five failure
modes METR scored are silent scope reduction rather than a wrong answer.

**Raising the reliability bar shortens the usable task by 4 to 6 times.** METR
time horizons, benchmark `METR-Horizon-v1.1`. Same models, same tasks, only the
bar changes. GPT-5: 203 minutes at 50%, 38 at 80%. Claude Opus 4.5: 293 and 49.
GPT-5.4: 342 and 54. The ratio has not closed as models improved.
[METR time horizons](https://metr.org/time-horizons/)

Two traps when citing this. Do not use the "7-month doubling time" figure;
METR banners that post as out of date. And METR states measurements above 16
hours are unreliable with the current task suite, so do not quote the two
entries that exceed it. Quoting an unreliable measurement to argue for
reliability would be the exact mistake this project is about.

**"Premature Disengagement" is the term in the literature.** Analysis of 4,018
SWE-bench Verified trajectories names three failure patterns: Analysis
Paralysis, Rogue Actions, and Premature Disengagement.
[arXiv:2502.08235](https://arxiv.org/abs/2502.08235), 2025-02-12

**Models prematurely commit and then do not recover.** Across 200,000+
simulated conversations, an average **39% drop** from single-turn to
multi-turn across six tasks. Verbatim: LLMs "make assumptions in early turns
and prematurely attempt to generate final solutions, on which they overly
rely", and "when LLMs take a wrong turn in a conversation, they get lost and do
not recover." The degradation is mostly "a significant increase in
unreliability" rather than lost capability.
[arXiv:2505.06120](https://arxiv.org/abs/2505.06120), 2025-05-09. Laban,
Hayashi, Zhou, Neville.

**Succeeding once predicts little about succeeding reliably.** tau-bench
introduced `pass^k`, success across all k trials. State-of-the-art function
calling agents scored "pass^8 <25% in retail".
[arXiv:2406.12045](https://arxiv.org/abs/2406.12045), 2024-06-17. Absolute
figures are from the gpt-4o era; the metric is the durable part.

**Most headline agent scores are self-reported.** Of 180 SWE-bench Verified
leaderboard entries, only 60 are marked independently checked. The top checked
score is 74.40%; the top unchecked self-report is 79.20%.
[swebench.com](https://www.swebench.com/)

**An agent is a poor judge of its own work.** "LLMs struggle to self-correct
their responses without external feedback, and at times, their performance even
degrades after self-correction."
[arXiv:2310.01798](https://arxiv.org/abs/2310.01798), 2023-10-03. This is from
2023 and predates current agentic systems. It is the origin of the idea, not a
current measurement.

## The three surfaces

**Copilot Studio.** Skills are accepted as a bare `.md` with YAML front matter
or a `.zip` containing `SKILL.md`, uploaded at Build, then Skills, then Add
skill, then Upload a skill.
[skills-add-existing](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/skills-add-existing)

**The `SKILL.md` format is an open standard**, not a Microsoft format:
`name` max 64 characters matching the directory, `description` max 1024
characters, body under 500 lines, four-stage progressive disclosure.
[agent-framework skills](https://learn.microsoft.com/en-us/agent-framework/agents/skills),
[agentskills.io](https://agentskills.io)

This is why one `SKILL.md` can serve all three surfaces.

**Cowork.** GA for work and school accounts since 2026-06-16, preview for
personal. Requires the Microsoft 365 Copilot licence plus usage-based Copilot
Credits at $0.01 per credit on pay-as-you-go. Off by default. Supports up to
**50 custom skills** in OneDrive at `/Documents/Cowork/skills/`, plus App Store
plugins carrying `agentSkills[]` and MCP `agentConnectors[]`.
[GA announcement](https://www.microsoft.com/en-us/microsoft-365/blog/2026/06/16/copilot-cowork-is-now-generally-available/),
[plugin development](https://learn.microsoft.com/en-us/microsoft-365/copilot/cowork/cowork-plugin-development)

**Scout.** Frontier-preview desktop app for Windows and macOS. Requires both a
Microsoft 365 Copilot licence and a GitHub Copilot Business or Enterprise seat,
and processes prompts through GitHub Copilot under the GitHub Customer
Agreement. Discovers custom skills from `~/.copilot/skills/` across three
tiers. Ships no verification or quality-gate concept: the controls are
three-tier approval, sensitivity labels, and thumbs up or down.
[get started](https://learn.microsoft.com/en-us/microsoft-scout/get-started),
[use Microsoft Scout](https://learn.microsoft.com/en-us/microsoft-scout/use-microsoft-scout)

## Deliberately not claimed

Recording these so nobody later mistakes an absence for an oversight.

- **The GA date of the GitHub Copilot harness.** Third-party sources cite
  Message Center post MC1446644 and 2026-08-03. No first-party page confirms
  it, so no date appears in this repository.
- **A minimum `pac` CLI version** for `pac copilot`. Not documented anywhere.
- **Size or format limits on Copilot Studio skill uploads.** Not documented.
  The 5 MB figure circulating applies to evaluation CSV uploads. The 20-file,
  5 MB and 10 MB limits are Cowork plugin companion-file limits. Do not
  conflate them.
- **`CLICopilotRecognizer` and `GenerativeAIRecognizer` as API.** The first
  appears in first-party test data, the second only in community tooling.
  Neither is on Microsoft Learn. Both are treated here as observed artifacts,
  which is why the `harness` probe returns `unknown` rather than guessing.
- **MCP support in Microsoft Scout.** No Scout page mentions it. MCP is
  verified for Cowork plugins and for `pac copilot mcp`, and is claimed for
  neither more nor less than that.
- **Current GAIA, OSWorld and WebArena scores.** Only the original-paper
  figures are verified, all from 2023 and 2024. Live results are materially
  higher. This repository cites none of them, because a dated baseline
  presented as current is exactly the kind of claim it argues against.
