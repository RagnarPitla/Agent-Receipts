#!/usr/bin/env python3
"""Fill the landing page template.

The numbers describing this repository's own ledger are read from
`receipts status` at build time, not typed in. They used to be typed in, and
the page went on claiming twelve proven and two open, and that no live-tenant
run existed, after both had stopped being true."""

import pathlib
import re
import subprocess
import sys
from html import escape as html_escape

SITE = pathlib.Path(__file__).resolve().parent
TPL = SITE.parent / "tools" / "index.template.html"
OUT = SITE / "index.html"

REPO = "https://github.com/RagnarPitla/Agent-Receipts"
URL = "https://ragnarpitla.github.io/Agent-Receipts/"

HERO_SVG = """<svg viewBox="0 0 545 400" role="img" aria-label="A contrast between two ways of closing a task. On the left, a single ticked checkbox sits alone with nothing underneath it, labelled the agent's word. On the right, the same checkbox has a command, an expected string and a recorded result hanging beneath it on a solid spine, labelled the evidence. A dashed vertical rule separates the two.">
  <text x="128" y="34" text-anchor="middle" fill="#737373" font-size="12" font-weight="700" letter-spacing="0.08em" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">THE AGENT'S WORD</text>

  <rect x="98" y="70" width="60" height="60" rx="10" fill="none" stroke="#0a0a0a" stroke-width="2.5"/>
  <path d="M112 100 L124 112 L146 86" stroke="#0a0a0a" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

  <g stroke="#e5e5e5" stroke-width="2" fill="none" stroke-dasharray="5 5">
    <path d="M128 130 V300"/>
  </g>
  <polygon points="128,200 135,207 128,214 121,207" fill="#e5e5e5"/>
  <polygon points="128,250 135,257 128,264 121,257" fill="#e5e5e5"/>

  <text x="128" y="330" text-anchor="middle" fill="#737373" font-size="13">nothing underneath it</text>
  <text x="128" y="352" text-anchor="middle" fill="#737373" font-size="13">but the claim itself</text>

  <line x1="260" y1="24" x2="260" y2="376" stroke="#e5e5e5" stroke-width="1.5" stroke-dasharray="4 5"/>

  <text x="400" y="34" text-anchor="middle" fill="#737373" font-size="12" font-weight="700" letter-spacing="0.08em" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">THE EVIDENCE</text>

  <rect x="290" y="70" width="60" height="60" rx="10" fill="none" stroke="#0a0a0a" stroke-width="2.5"/>
  <path d="M304 100 L316 112 L338 86" stroke="#0a0a0a" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

  <path d="M320 130 V300" stroke="#0a0a0a" stroke-width="3" fill="none" stroke-linecap="round"/>

  <polygon points="320,164 328,172 320,180 312,172" fill="#0a0a0a"/>
  <text x="346" y="177" fill="#0a0a0a" font-size="13" font-weight="650">a command</text>

  <polygon points="320,224 328,232 320,240 312,232" fill="#0a0a0a"/>
  <text x="346" y="237" fill="#0a0a0a" font-size="13" font-weight="650">a string it must print</text>

  <polygon points="320,284 328,292 320,300 312,292" fill="#0a0a0a"/>
  <text x="346" y="297" fill="#0a0a0a" font-size="13" font-weight="650">what it actually printed</text>

  <text x="400" y="352" text-anchor="middle" fill="#737373" font-size="13">checkable by someone who was not there</text>
</svg>"""

PROBLEM_BODY = """<p>You asked the agent to deploy a skill to a Copilot Studio agent. It ran
      <code>pac copilot push</code>. The command printed a success line and exited zero. The agent
      reported the deployment complete, because from where it was standing the deployment was
      complete.</p>

      <p>Then the evaluation scores came back mediocre. So you spent an afternoon on the
      instructions, then on the knowledge sources, then on the topic routing. None of it moved the
      numbers, because the skill was never on the agent. <code>pac copilot push</code> updates
      components that already exist. Point it at a new one and it succeeds at doing nothing, and
      says so in the same green text it uses when it works.</p>

      <p class="muted">That is not a modelling problem and it is not carelessness. The only thing
      anyone checked was a log line the agent wrote about its own work. Every layer above that
      inherited the mistake, and the layer that could have caught it - reading the agent in the
      environment and comparing it to what was supposed to be there - is the one nobody ran,
      because nothing asked them to.</p>

      <figure class="figure">
        <div class="diagram">
          <svg viewBox="0 0 900 300" role="img" aria-label="Two paths compared. Along the top, an agent runs a push command, reads the success line it printed, marks the task done, and the outcome is a skill that was never deployed. Along the bottom, the same push runs, then a probe reads the components on the live agent, compares them to the source files, and either records evidence or fails the gate. A dashed rule separates the two paths.">
            <text x="30" y="28" fill="#737373" font-size="12" font-weight="700" letter-spacing="0.08em" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">WHAT HAPPENS NOW</text>

            <rect x="30" y="46" width="150" height="46" rx="7" fill="none" stroke="#737373" stroke-width="2"/>
            <text x="105" y="68" text-anchor="middle" font-size="13" font-weight="650" fill="#0a0a0a">pac copilot push</text>
            <text x="105" y="85" text-anchor="middle" font-size="11" fill="#737373">exits zero</text>

            <path d="M180 69 H208" stroke="#737373" stroke-width="2" fill="none"/>
            <polygon points="208,65 216,69 208,73" fill="#737373"/>

            <rect x="222" y="46" width="150" height="46" rx="7" fill="none" stroke="#737373" stroke-width="2"/>
            <text x="297" y="68" text-anchor="middle" font-size="13" font-weight="650" fill="#0a0a0a">read the log</text>
            <text x="297" y="85" text-anchor="middle" font-size="11" fill="#737373">it says success</text>

            <path d="M372 69 H400" stroke="#737373" stroke-width="2" fill="none"/>
            <polygon points="400,65 408,69 400,73" fill="#737373"/>

            <rect x="414" y="46" width="150" height="46" rx="7" fill="none" stroke="#737373" stroke-width="2"/>
            <text x="489" y="68" text-anchor="middle" font-size="13" font-weight="650" fill="#0a0a0a">tick the box</text>
            <text x="489" y="85" text-anchor="middle" font-size="11" fill="#737373">task closed</text>

            <path d="M564 69 H592" stroke="#737373" stroke-width="2" fill="none"/>
            <polygon points="592,65 600,69 592,73" fill="#737373"/>

            <rect x="606" y="46" width="264" height="46" rx="7" fill="none" stroke="#e5e5e5" stroke-width="2"/>
            <text x="738" y="68" text-anchor="middle" font-size="13" font-weight="650" fill="#737373">the skill is not on the agent</text>
            <text x="738" y="85" text-anchor="middle" font-size="11" fill="#737373">found days later, by a user</text>

            <line x1="30" y1="128" x2="870" y2="128" stroke="#e5e5e5" stroke-width="1.5" stroke-dasharray="4 5"/>

            <text x="30" y="164" fill="#737373" font-size="12" font-weight="700" letter-spacing="0.08em" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">WHAT THIS DOES INSTEAD</text>

            <rect x="30" y="182" width="150" height="46" rx="7" fill="none" stroke="#0a0a0a" stroke-width="2"/>
            <text x="105" y="204" text-anchor="middle" font-size="13" font-weight="650" fill="#0a0a0a">pac copilot push</text>
            <text x="105" y="221" text-anchor="middle" font-size="11" fill="#737373">same command</text>

            <path d="M180 205 H208" stroke="#0a0a0a" stroke-width="2" fill="none"/>
            <polygon points="208,201 216,205 208,209" fill="#0a0a0a"/>

            <rect x="222" y="182" width="150" height="46" rx="7" fill="none" stroke="#0a0a0a" stroke-width="2"/>
            <text x="297" y="204" text-anchor="middle" font-size="13" font-weight="650" fill="#0a0a0a">read the agent</text>
            <text x="297" y="221" text-anchor="middle" font-size="11" fill="#737373">not the log</text>

            <path d="M372 205 H400" stroke="#0a0a0a" stroke-width="2" fill="none"/>
            <polygon points="400,201 408,205 400,209" fill="#0a0a0a"/>

            <rect x="414" y="182" width="150" height="46" rx="7" fill="none" stroke="#0a0a0a" stroke-width="2"/>
            <text x="489" y="204" text-anchor="middle" font-size="13" font-weight="650" fill="#0a0a0a">compare to source</text>
            <text x="489" y="221" text-anchor="middle" font-size="11" fill="#737373">byte for byte</text>

            <path d="M564 205 H592" stroke="#0a0a0a" stroke-width="2" fill="none"/>
            <polygon points="592,201 600,205 592,209" fill="#0a0a0a"/>

            <rect x="606" y="182" width="264" height="46" rx="7" fill="none" stroke="#0a0a0a" stroke-width="3"/>
            <text x="738" y="204" text-anchor="middle" font-size="13" font-weight="650" fill="#0a0a0a">evidence, or the gate fails</text>
            <text x="738" y="221" text-anchor="middle" font-size="11" fill="#737373">found in seconds, by you</text>
          </svg>
        </div>
        <figcaption>The command does not change. What changes is that something reads the agent
        afterwards and refuses to take the log's word for it.</figcaption>
      </figure>"""

HOW_STEPS = """<li>
          <h3>Write the outcomes down before the work starts</h3>
          <p>A ledger is a Markdown file. Each gate is one outcome that has to be true, plus the
          command that would fail if it were not, plus the string that command has to print.
          <code>receipts init</code> writes a starter ledger for Copilot Studio or for anything
          else. Ten minutes, and it is the only ten minutes of overhead in the whole thing.</p>
        </li>
        <li>
          <h3>Run the checks and let them write the evidence</h3>
          <p><code>receipts check</code> executes each unproven gate, requires exit zero
          <em>and</em> a match against the expected string, and writes what it actually saw into the
          file. Nothing else may write that line. If a check fails, the tick is removed rather than
          left standing next to a failure.</p>
        </li>
        <li>
          <h3>A tick with no evidence is reported as unmet</h3>
          <p>This is the rule the rest of it hangs off. An agent that ticks a box to look finished
          gets a worse result than one that leaves it open, because the ledger names the gate
          self-reported and the run exits non-zero. The cheapest way to look done stops working.</p>
        </li>
        <li>
          <h3>Paste the report into the pull request</h3>
          <p><code>receipts report</code> emits a Markdown table: every gate, its state, and the
          evidence behind it. A reviewer who was not in the room can see which outcomes were proven
          by a machine, which were signed off by a named person, and which are still open.</p>
        </li>"""

JOBS_CARDS = """<li>
          <span class="job-kicker">Ledger</span>
          <h3>Five states, and only one of them means proven</h3>
          <p>Open, met, self-reported, attested, abandoned. Attested gates name a person and a date
          and are counted separately, never as proof, because some outcomes genuinely need a human
          and pretending otherwise with a grep is worse than admitting it. Abandoned gates carry a
          reason and make the run exit non-zero, so quitting is allowed but silence is not.</p>
        </li>
        <li>
          <span class="job-kicker">Probe</span>
          <h3>Eight questions about a Copilot Studio agent, answered by reading the agent</h3>
          <p>Is the skill really deployed. Do the deployed bytes match the reviewed bytes. Is
          anything live that nobody reviewed. Is this the harness you assumed. Every probe issues
          GET requests and nothing else, and every one runs offline against a fixture file so you
          can wire up CI without a tenant.</p>
        </li>
        <li>
          <span class="job-kicker">Lint</span>
          <h3>Seven ways to write a check that cannot fail</h3>
          <p><code>echo "PROOF OK"</code>. A command ending in <code>|| true</code>. An expected
          string written inside the command being graded. An attestation signed by nobody. Lint
          names them in the diff, where a reviewer can see the check as well as the tick.</p>
        </li>"""

DEMO_ROWS = """<li class="is-main">
              <span class="key">[!]</span>
              <span class="name">D1: the skill is on the agent<span class="tag">self-reported</span></span>
              <span class="meta">counts as unmet</span>
            </li>
            <li>
              <span class="key">[x]</span>
              <span class="name">Q1: every skill answers the seven questions</span>
              <span class="meta">proven</span>
            </li>
            <li>
              <span class="key">[~]</span>
              <span class="name">H1: a named reviewer ran the three journeys</span>
              <span class="meta">attested</span>
            </li>
            <li>
              <span class="key">[ ]</span>
              <span class="name">Q2: every skill is covered by an evaluation</span>
              <span class="meta">open</span>
            </li>
            <li class="is-pending">
              <span class="key">live</span>
              <span class="name">no run against a real tenant is recorded in this example</span>
              <span class="meta">not yet done</span>
            </li>"""

def ledger_status():
    """Ask the tool for the ledger state instead of reimplementing its parser here.

    A second parser is a second thing that can disagree with the first, and the
    page would then be able to report a state the tool never produced. `status`
    executes nothing, so it is safe to run during a build.
    """
    r = subprocess.run(
        ["node", "bin/receipts.mjs", "status", "GATES.md"],
        cwd=SITE.parent, capture_output=True, text=True, timeout=120,
    )
    text = r.stdout
    m = re.search(
        r"proven (\d+)\s+attested (\d+)\s+open (\d+)\s+self-reported (\d+)\s+abandoned (\d+)\s+of (\d+)",
        text,
    )
    if not m:
        raise SystemExit(
            "fill.py could not read the ledger summary from `receipts status`.\n"
            "Refusing to build a page with numbers nobody checked.\n"
            f"stdout was:\n{text[:600]}\nstderr:\n{r.stderr[:400]}"
        )
    proven, attested, opened, selfrep, abandoned, total = (int(x) for x in m.groups())
    gates = re.findall(r"^\s+\[([x !~])\] ([A-Z]\d+): (.+)$", text, re.M)
    return {
        "proven": proven, "attested": attested, "open": opened,
        "self_reported": selfrep, "abandoned": abandoned, "total": total,
        "summary": m.group(0),
        "gates": [{"mark": g[0], "id": g[1], "title": g[2].strip()} for g in gates],
        "verdict": "MET" if "\n  MET" in text else "NOT MET",
    }


WORDS = ("zero one two three four five six seven eight nine ten eleven twelve "
         "thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty").split()


def word(n):
    return WORDS[n] if n < len(WORDS) else str(n)


def proof_body():
    """Build the section that reports this repository's own ledger.

    Every number below comes from `receipts status`. The previous version of this
    function had them typed in, and when gate E1 was closed the page went on
    saying twelve proven, two open, and "no run against a live tenant has been
    recorded", which by then was the opposite of the truth.
    """
    st = ledger_status()
    closed = st["proven"]
    still_open = st["open"] + st["self_reported"]

    shown = [g for g in st["gates"] if g["mark"] == "x"][:5]
    shown += [g for g in st["gates"] if g["mark"] != "x"]

    def line(g):
        mark = {"x": "[x]", " ": "[ ]", "!": "[!]", "~": "[~]"}[g["mark"]]
        title = g["title"]
        if len(title) > 62:
            head, _, tail = title[:62].rpartition(" ")
            return (f"  {mark} {g['id']}: {html_escape(head)}\n"
                    f"          {html_escape(tail + title[62:])}")
        return f"  {mark} {g['id']}: {html_escape(title)}"

    rows = "\n".join(line(g) for g in shown)

    open_ids = [g["id"] for g in st["gates"] if g["mark"] != "x"]
    open_phrase = " and ".join(open_ids) if open_ids else "none"

    if open_ids:
        exits = (f"{word(still_open).capitalize()} "
                 f"{'is' if still_open == 1 else 'are'} open, so the run exits 1 "
                 f"and the project is not done.")
    else:
        exits = "None are open."

    gap = GAP_CLOSED if not open_ids else GAP_OPEN.format(
        ids=open_phrase,
        which="that gate" if len(open_ids) == 1 else "those gates",
    )

    return PROOF_HEAD + f"""<p>The repository runs this on itself. <code>GATES.md</code> at the root is a real
          ledger, not an example, and this is what it says today. {word(closed).capitalize()} gates are closed by
          a command. {exits} The gate
          lines below are an excerpt; the summary counts all {word(st['total'])}.</p>

          <div class="terminal">
<pre><span class="prompt">$</span> receipts check GATES.md --approve
{rows}

  {st['summary']}

  {st['verdict']}</pre>
          </div>

          {gap}
""" + PROOF_TAIL_TPL.format(g2=html_escape(evidence_line("G2")))


GAP_OPEN = """<p><strong>{ids} is the honest gap.</strong> It is not closed by a command,
          so it is not counted as proven. Leaving {which} open costs a green tick and buys the
          only thing that makes the rest of the page worth reading.</p>"""

GAP_CLOSED = """<p>Every gate in the file is now closed by a command that was run, and the
          evidence line under each one records what that run saw.</p>"""


PROOF_HEAD = """<p>That is real output from <code>receipts status</code>, not a mock-up. Gate D1 was
          ticked. Its evidence line still read <code>pending</code>, so the ledger reports it as
          unmet and names it self-reported, and the whole run exits 1.</p>

          <div class="terminal">
<pre><span class="prompt">$</span> receipts status GATES.md
  [!] D1: the skill is on the agent in the environment
      SELF-REPORTED. The box is ticked and the evidence is still pending.
      This counts as unmet. An empty box is more honest than this one.
  [x] Q1: every skill answers the seven questions
  [~] H1: a named reviewer ran the three journeys that matter
      attested by Priya Nair priya@contoso.com on 2026-08-14
  [ ] Q2: every skill is covered by an evaluation case

  proven 1   attested 1   open 1   self-reported 1   abandoned 0   of 4

  NOT MET</pre>
          </div>

          <p>And here is the push trap caught in the act. The deployment reported success. The
          probe read the agent and found nothing there.</p>

          <div class="terminal">
<pre><span class="prompt">$</span> receipts probe skill-deployed --path ./skills \\
    --fixture tests/fixtures/agent-push-trap.json
PROOF FAIL 2 skill(s) named in the ledger are not on the agent
  expected: match-exception-explainer, weak-skill
  on agent: (none)
  MISSING: match-exception-explainer
      &lt;- push reported success; the component does not exist
  MISSING: weak-skill
      &lt;- push reported success; the component does not exist</pre>
          </div>

          """

def evidence_line(gate_id):
    """Read one gate's evidence line out of GATES.md.

    This was pasted in by hand and drifted: it still quoted a PATH fingerprint
    and a timestamp from a run two days older than the one the page reported.

    The capture is `[^\\n]+` rather than `.+` on purpose. With re.S in force a
    greedy `.+` runs past the end of the line and swallows the rest of the
    file, which is how the first version of this put forty lines of ledger, and
    an absolute home directory path, onto a public page.
    """
    text = (SITE.parent / "GATES.md").read_text(encoding="utf-8")
    m = re.search(rf"^- \[.\] {gate_id}:.*?^\s+EVIDENCE: ([^\n]+)$", text, re.M | re.S)
    if not m:
        raise SystemExit(f"fill.py could not find an EVIDENCE line for {gate_id} in GATES.md")
    line = m.group(1).strip()
    # The cwd is whoever happened to run it. It proves nothing and it is somebody's
    # home directory, so it does not belong on a published page.
    line = re.sub(r"\s*\|\s*cwd=[^|]+", "", line)
    # Drop the fields that change on every run without the result changing.
    # Publishing them made this page disagree with its own generator after any
    # second run: ms= and at= moved, output=sha256: did not. That is churn, not
    # a change, and a page that cannot tell the two apart has no business
    # making the argument this one makes.
    line = re.sub(r"\s*\|\s*ms=[^|]+", "", line)
    line = re.sub(r"\s*\|\s*at=[^|]+", "", line)
    line = re.sub(r"\s*\|\s*", " | ", line)
    if "\n" in line or len(line) > 300:
        raise SystemExit(f"fill.py read an implausible evidence line for {gate_id}: {line[:120]!r}")
    return line


PROOF_TAIL_TPL = """
          <p class="muted">Each closed gate carries what the run actually saw. G2's evidence line
          reads <code>{g2}</code>.
          The PATH fingerprint is there because a command that passes on your machine and fails in
          CI is usually a different PATH, not a different bug. The stored line also carries a
          duration and a timestamp, which this page drops: they move on every run while the output
          hash does not. Re-running a check is not the same as a result changing, and a page that
          confused the two would have to be rebuilt every time nothing happened.</p>"""

COMPARE_CARDS = """<div class="compare-card">
          <h3>Compared with Copilot Studio's built-in evaluation</h3>
          <p>General quality is a genuinely useful signal and you should turn it on. It scores
          relevance, groundedness, completeness and abstention, and it flags a response when any one
          of the four is not met. On the GitHub Copilot harness it is also the only test method
          available - and Microsoft's own documentation says it "doesn't compare responses to
          expected answers". That works exactly until the question is whether your match exception
          skill returned the right exception, or whether it was ever deployed at all. Those are not
          quality judgements. They are facts, and a fact needs a different instrument.</p>
        </div>
        <div class="compare-card">
          <h3>Compared with Azure AI Foundry's agent evaluators</h3>
          <p>Microsoft already named this failure mode and built for it. Foundry ships a
          <code>Task Completion</code> evaluator defined as "a usable deliverable that meets all
          user requirements", and a <code>Response Completeness</code> evaluator for "not missing
          critical information". They are good, and this project is not an argument that nobody
          thought of it. The boundary is where they run: offline, in Foundry, behind a judge model
          deployment and an SDK. None of that is available inside a Copilot Studio agent on the
          GitHub Copilot harness, inside Cowork, or inside Scout, which is where the work actually
          happens.</p>
        </div>"""

ASSURANCE_BODY = """<p>This runs shell commands that an agent proposed, against environments that
      matter. That deserves a straight account of where the edges are.</p>

      <p>The eight probes issue GET requests and nothing else. There is no code path in
      <code>src/probes/</code> that issues POST, PATCH, PUT or DELETE, and no flag that would let
      you make one. A probe can tell you a skill is missing; it cannot deploy it. Verification that
      can mutate the thing it is verifying is not verification.</p>

      <p>Checks are approved once, and the approval is bound to the exact command, the expected
      string, the working directory, the shell, the timeout, the platform and the PATH. Change any
      one and the approval no longer applies, so approving <code>npm test</code> does not approve
      <code>npm test &amp;&amp; curl -X POST ...</code>, and does not approve the same
      <code>npm test</code> run somewhere else where it means something different. The approval
      store lives outside the repository at <code>~/.receipts/approvals.json</code>, mode 0600,
      because an approval that arrives with <code>git pull</code> is a decision someone else made
      on your behalf.</p>

      <p>What it does not do, stated plainly. It does not sandbox the command: an approved check
      runs with your privileges, and the prompt showing you the full command is where that decision
      gets made. It does not stop a determined author from writing a check that always passes -
      lint catches seven common shapes and someone who wants to fake a gate can write an eighth.
      The defence there is that the check sits in the diff next to the tick, where a reviewer can
      read it. It does not re-verify evidence retroactively, so <code>status</code> reports the age
      of every piece and you re-run before you merge.</p>"""

JOBS_FIGURE = """<figure class="figure">
        <div class="diagram">
          <svg viewBox="0 0 900 250" role="img" aria-label="The five states a gate can hold. An open gate runs its check and moves to proven when the command exits zero and its output matches the expected string. If the check fails, the tick is removed and the gate returns to open rather than staying ticked next to a failure. A second dashed path leaves the open gate, skips the check entirely, and runs into a stop barrier. Two states sit outside that loop: attested, which a named person signs with a date and which is never counted as proven, and abandoned, which carries a written reason and makes the whole run exit non-zero. A sixth path, ticking the box by hand without evidence, is drawn as a dead end labelled reported as unmet.">
            <g font-size="13" font-weight="650" text-anchor="middle">
              <rect x="30" y="60" width="130" height="46" rx="7" fill="none" stroke="#0a0a0a" stroke-width="2"/>
              <text x="95" y="82" fill="#0a0a0a">[ ] open</text>
              <text x="95" y="98" fill="#737373" font-size="11" font-weight="400">not done yet</text>

              <rect x="250" y="60" width="150" height="46" rx="7" fill="none" stroke="#0a0a0a" stroke-width="2"/>
              <text x="325" y="82" fill="#0a0a0a">receipts check</text>
              <text x="325" y="98" fill="#737373" font-size="11" font-weight="400">runs the command</text>

              <rect x="490" y="60" width="150" height="46" rx="7" fill="none" stroke="#0a0a0a" stroke-width="3"/>
              <text x="565" y="82" fill="#0a0a0a">[x] proven</text>
              <text x="565" y="98" fill="#737373" font-size="11" font-weight="400">evidence written</text>
            </g>

            <g stroke="#0a0a0a" stroke-width="2" fill="none">
              <path d="M160 83 H240"/>
              <path d="M400 83 H480"/>
            </g>
            <polygon points="240,79 248,83 240,87" fill="#0a0a0a"/>
            <polygon points="480,79 488,83 480,87" fill="#0a0a0a"/>

            <path d="M325 106 V146 H95 V110" stroke="#737373" stroke-width="2" fill="none" stroke-dasharray="5 4"/>
            <polygon points="91,110 95,102 99,110" fill="#737373"/>
            <text x="210" y="166" text-anchor="middle" fill="#737373" font-size="12">check fails, the tick is removed</text>

            <path d="M52 106 V209 H240" stroke="#d4d4d4" stroke-width="2" fill="none" stroke-dasharray="6 4"/>
            <polygon points="240,205 248,209 240,213" fill="#d4d4d4"/>

            <path d="M540 209 H586" stroke="#d4d4d4" stroke-width="2" fill="none" stroke-dasharray="6 4"/>
            <line x1="592" y1="192" x2="592" y2="226" stroke="#737373" stroke-width="3"/>
            <line x1="602" y1="192" x2="602" y2="226" stroke="#737373" stroke-width="3"/>
            <text x="597" y="182" text-anchor="middle" fill="#737373" font-size="11">stops here</text>

            <line x1="680" y1="40" x2="680" y2="210" stroke="#e5e5e5" stroke-width="1.5" stroke-dasharray="4 5"/>
            <text x="790" y="34" text-anchor="middle" fill="#737373" font-size="11" font-weight="700" letter-spacing="0.08em" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">OUTSIDE THE LOOP</text>

            <g font-size="13" font-weight="650" text-anchor="middle">
              <rect x="715" y="52" width="150" height="46" rx="7" fill="none" stroke="#737373" stroke-width="2"/>
              <text x="790" y="74" fill="#0a0a0a">[~] attested</text>
              <text x="790" y="90" fill="#737373" font-size="11" font-weight="400">a named person, dated</text>

              <rect x="715" y="122" width="150" height="46" rx="7" fill="none" stroke="#737373" stroke-width="2"/>
              <text x="790" y="144" fill="#0a0a0a">[-] abandoned</text>
              <text x="790" y="160" fill="#737373" font-size="11" font-weight="400">a written reason</text>
            </g>

            <g font-size="13" font-weight="650" text-anchor="middle">
              <rect x="250" y="186" width="290" height="46" rx="7" fill="none" stroke="#e5e5e5" stroke-width="2" stroke-dasharray="6 4"/>
              <text x="395" y="208" fill="#737373">[x] ticked by hand, evidence pending</text>
              <text x="395" y="224" fill="#737373" font-size="11" font-weight="400">reported as unmet - a dead end, not a shortcut</text>
            </g>
          </svg>
        </div>
        <figcaption>Only the box on the far right means proven. Attested and abandoned are counted
        separately and never folded into that number, and the dashed box at the bottom is the one an
        agent reaches for when it wants to look finished.</figcaption>
      </figure>"""

BOUNDARY_FIGURE = """<figure class="figure">
        <div class="diagram">
          <svg viewBox="0 0 760 252" role="img" aria-label="An ownership split. On the left, this project owns the ledger file in your repository, the evidence it writes, the approval store on your own machine, and the report pasted into a pull request. On the right, the platform owns the agent runtime, the environment and Dataverse state, publishing, and governance and data loss prevention policy. A dashed vertical line marks the boundary, and the project only ever reads across it.">
            <text x="180" y="26" text-anchor="middle" fill="#737373" font-size="11" font-weight="700" letter-spacing="0.08em" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">THIS PROJECT WRITES</text>
            <text x="570" y="26" text-anchor="middle" fill="#737373" font-size="11" font-weight="700" letter-spacing="0.08em" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">THE PLATFORM OWNS</text>

            <line x1="380" y1="16" x2="380" y2="244" stroke="#737373" stroke-width="1.5" stroke-dasharray="4 5"/>

            <g font-size="13" fill="#0a0a0a">
              <polygon points="46,58 53,65 46,72 39,65" fill="#0a0a0a"/>
              <text x="68" y="70">GATES.md in your repository</text>
              <polygon points="46,98 53,105 46,112 39,105" fill="#0a0a0a"/>
              <text x="68" y="110">the evidence lines it records</text>
              <polygon points="46,138 53,145 46,152 39,145" fill="#0a0a0a"/>
              <text x="68" y="150">approvals, on your machine only</text>
              <polygon points="46,178 53,185 46,192 39,185" fill="#0a0a0a"/>
              <text x="68" y="190">the table you paste into a PR</text>
            </g>

            <g font-size="13" fill="#737373">
              <polygon points="416,58 423,65 416,72 409,65" fill="#e5e5e5"/>
              <text x="438" y="70">the agent runtime</text>
              <polygon points="416,98 423,105 416,112 409,105" fill="#e5e5e5"/>
              <text x="438" y="110">environment and Dataverse state</text>
              <polygon points="416,138 423,145 416,152 409,145" fill="#e5e5e5"/>
              <text x="438" y="150">publishing</text>
              <polygon points="416,178 423,185 416,192 409,185" fill="#e5e5e5"/>
              <text x="438" y="190">governance and DLP policy</text>
            </g>

            <rect x="288" y="208" width="188" height="20" fill="var(--card)"/>
            <text x="382" y="222" text-anchor="middle" fill="#0a0a0a" font-size="12" font-weight="650">reads across, never writes</text>
            <path d="M258 234 H494" stroke="#0a0a0a" stroke-width="2" fill="none"/>
            <polygon points="494,229 504,234 494,239" fill="#0a0a0a"/>
          </svg>
        </div>
        <figcaption>Everything on the right is read and never written. That is the line the tool
        does not cross, and it is a one-line grep to hold it to that.</figcaption>
      </figure>"""

ASSURANCE_ITEMS = """<li>

          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Zm0 2.2 6 2.2v4.6c0 4-2.6 6.9-6 8-3.4-1.1-6-4-6-8V6.4l6-2.2Z"/></svg>
          Read-only against your tenant. Zero write calls in any probe, and it is a one-line grep to check.
        </li>
        <li>
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Zm0 2.2 6 2.2v4.6c0 4-2.6 6.9-6 8-3.4-1.1-6-4-6-8V6.4l6-2.2Z"/></svg>
          No credential is ever written to the ledger, the evidence, or the report.
        </li>
        <li>
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Zm0 2.2 6 2.2v4.6c0 4-2.6 6.9-6 8-3.4-1.1-6-4-6-8V6.4l6-2.2Z"/></svg>
          Every probe runs offline against a fixture file, so CI needs no environment.
        </li>
        <li>
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Zm0 2.2 6 2.2v4.6c0 4-2.6 6.9-6 8-3.4-1.1-6-4-6-8V6.4l6-2.2Z"/></svg>
          Zero runtime dependencies. Node 18 or newer, and nothing else to audit.
        </li>
        <li>
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Zm0 2.2 6 2.2v4.6c0 4-2.6 6.9-6 8-3.4-1.1-6-4-6-8V6.4l6-2.2Z"/></svg>
          MIT licensed. A personal project, not a Microsoft product.
        </li>
        <li>
          <svg class="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Zm0 2.2 6 2.2v4.6c0 4-2.6 6.9-6 8-3.4-1.1-6-4-6-8V6.4l6-2.2Z"/></svg>
          No telemetry, no network calls the tool makes on its own behalf.
        </li>"""

FAQ = [
    ("Is this saying AI agents are lazy?",
     """<p>Not as a character flaw, no. The behaviour is real and it has been measured, but calling
     it laziness gets the mechanism wrong and the fix wrong with it.</p>
     <p>An agent stops when its own signal says stop. If the signal is a log line saying "success",
     it stops there, and it is being perfectly reasonable given what it can see. The literature
     calls this premature disengagement and it shows up as a named pattern across 4,018 SWE-bench
     trajectories. METR gave an agent 18 real issues in August 2025: it passed 38 percent of the
     maintainers' own tests, and on manual review none of the 15 pull requests examined were
     mergeable as they stood. Even the ones that passed every human-written test needed about 26
     minutes of fixing.</p>
     <p>So the problem is not effort. It is that the agent's finish line is drawn in the wrong
     place, and nothing external moves it. This moves it.</p>"""),

    ("How is this different from turning on agent evaluations?",
     """<p>They answer different questions and you want both.</p>
     <p>Evaluations ask whether an answer was good. This asks whether the thing you built is
     actually there and actually matches what was reviewed. An evaluation running against an agent
     that silently never received your skill will return numbers, and they will be numbers about
     the old agent. That is the exact scenario this was written for.</p>"""),

    ("Does it write anything to my Copilot Studio environment?",
     """<p>No. Every probe issues GET requests. There is no POST, PATCH, PUT or DELETE anywhere in
     <code>src/probes/</code>, and no flag that adds one.</p>
     <p>Do not take that on trust, since taking things on trust is what the project is about. Clone
     it and run <code>grep -rnE "'(POST|PATCH|PUT|DELETE)'" src/probes/</code>. It returns
     nothing.</p>"""),

    ("Can I try it without a tenant?",
     """<p>Yes, and this is the fastest way to see what it does. Every probe takes
     <code>--fixture &lt;file.json&gt;</code> and reads a JSON payload instead of an environment.
     Two fixtures ship with the repo: one healthy agent and one that reproduces the push trap.</p>
     <p>The full test suite - 37 tests - runs with no network and no credentials, which is also why
     it can run in CI on a fork.</p>"""),

    ("What stops someone writing a check that always passes?",
     """<p>Partly lint, and partly the pull request.</p>
     <p><code>receipts lint</code> catches seven shapes: a command that only echoes its own
     expected string, an expected string written inside the command being graded, a trailing
     <code>|| true</code> that swallows the exit code, an expectation so short it matches anything,
     a command that only lists or prints, a check that asks the agent whether it finished, and an
     attestation with nobody's name on it.</p>
     <p>That is a heuristic and someone determined will get past it. The structural answer is that
     the check lives in the diff next to the tick, so a reviewer sees the evidence and the reason
     to believe it at the same time. A gate closed by a check nobody read is a gate closed by
     nobody.</p>"""),

    ("Does this only work with Copilot Studio?",
     """<p>The ledger, the runner, the approval model and the lint rules are platform-neutral. Any
     project can use them: <code>receipts init --preset generic</code> writes a ledger whose checks
     are your own build and test commands.</p>
     <p>The eight probes are Copilot Studio specific, because that is where the sharpest version of
     the problem lives and where a generic tool has nothing useful to say.</p>"""),

    ("What about Cowork and Scout?",
     """<p>Planned, not built, and it would be against the spirit of the project to imply
     otherwise.</p>
     <p>The path is real though, and it is short. A skill is a <code>SKILL.md</code> file under an
     open standard rather than a Microsoft format, which is why the same file can serve all three.
     Cowork reads up to 50 custom skills from OneDrive at
     <code>/Documents/Cowork/skills/</code>. Scout discovers skills from
     <code>~/.copilot/skills/</code>. Both surfaces ship the same sentence in their FAQ: Microsoft
     does not validate custom skills created by users. So the gap is identical on all three, and
     one skill file plus a different install path covers it.</p>"""),

    ("Is this a Microsoft product?",
     """<p>No. It is a personal open-source project, MIT licensed, and views expressed in it are my
     own and do not represent Microsoft's official position.</p>
     <p>It is deliberately collegial about the platform. Microsoft has already named this failure
     mode and shipped evaluators for it in Azure AI Foundry. The argument here is narrower: those
     evaluators are not available on the surfaces where agents actually run, and something small
     and local can close that gap today.</p>"""),

    ("What is not finished?",
     """<p>The engine, the eight probes, the lint rules and the 37 tests all work today. What does
     not exist yet: a recorded run against a live tenant published here as evidence, the Cowork and
     Scout install paths, and a packaged npm release. Those are marked as pending on this page
     rather than described in the present tense, which is the same standard the tool applies to a
     ticked box.</p>"""),
]


def faq_html():
    chev = ('<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" '
            'aria-hidden="true" focusable="false"><path fill="currentColor" '
            'd="M9 6l6 6-6 6V6z"/></svg>')
    out = []
    for q, a in FAQ:
        out.append(
            f'<details class="faq-item">\n'
            f'          <summary>{q}{chev}</summary>\n'
            f'          <div class="faq-answer">{a}</div>\n'
            f'        </details>'
        )
    return "\n        ".join(out)


VALUES = {
    "PRODUCT": "Agent Receipts",
    "SHORT_STRAPLINE": "proof of work for Copilot Studio agents",
    "SITE_URL": URL,
    "REPO_URL": REPO,
    "PRIMARY_CTA_URL": REPO + "#quick-start",
    "PRIMARY_CTA_LABEL": "Quick start",
    "PROOF_NAV_LABEL": "Proof",

    "ONE_LINE_PROMISE": ("Agent Receipts makes a Copilot Studio agent prove it finished, by "
                         "checking the agent instead of the log."),
    "META_DESCRIPTION": ("Agents stop early and report done. Agent Receipts turns every outcome "
                         "into a gate with a command behind it, reads the live Copilot Studio "
                         "agent rather than the deployment log, and reports a ticked box with no "
                         "evidence as unmet. MIT licensed, zero dependencies, read-only."),

    "HERO_HEADLINE": "Agents cut corners quietly. Catch it before your users do.",
    "HERO_SUBLINE": ("Every outcome your Copilot Studio agent has to deliver becomes a line in a "
                     "ledger with a real command behind it. <strong>A ticked box whose evidence "
                     "still reads pending is reported as unmet</strong>, so an agent cannot close "
                     "a gate by saying it did. The checks read the live agent, not the deployment "
                     "log that told you it worked."),
    "MICRO_1": "MIT licensed",
    "MICRO_2": "Zero dependencies",
    "MICRO_3": "Read-only against your tenant",
    "HERO_SVG": HERO_SVG,

    "PROBLEM_HEADING": "The afternoon you lose to a green success message",
    "PROBLEM_BODY": PROBLEM_BODY,

    "HOW_LEDE": ("Four steps, and only the first one costs you anything. The rest is a command you "
                 "run and a table you paste."),
    "HOW_STEPS": HOW_STEPS,

    "JOBS_HEADING": "Three parts, one job",
    "JOBS_LEDE": ("They are one thing because they answer one question in sequence: what has to be "
                  "true, is it actually true, and is the check that says so worth anything."),
    "JOBS_CARDS": JOBS_CARDS,
    "JOBS_FIGURE": JOBS_FIGURE,

    "PROOF_HEADING": "What it looks like when it catches something",
    "PROOF_LEDE": ("Both transcripts below are copied from real runs in this repository. You can "
                   "reproduce the second one in about thirty seconds with no tenant and no "
                   "credentials."),
    "DEMO_LABEL": "receipts status GATES.md",
    "DEMO_INTRO": ("Four gates and one honest gap. The first row was ticked by hand and is reported "
                   "as unmet anyway."),
    "DEMO_ROWS": DEMO_ROWS,
    "PROOF_BODY": proof_body(),

    "COMPARE_HEADING": "Where this sits next to what Microsoft already ships",
    "COMPARE_CARDS": COMPARE_CARDS,
    "COMPARE_CLOSE": ("<strong>The check exists; it is just not available where the work runs.</strong> "
                      "This is a small local tool that puts it there, on the surface you are "
                      "actually building on, today."),

    "ASSURANCE_HEADING": "What it does, and what it deliberately does not",
    "ASSURANCE_BODY": ASSURANCE_BODY + "\n      " + BOUNDARY_FIGURE,
    "ASSURANCE_ITEMS": ASSURANCE_ITEMS,

    "FAQ_ITEMS": faq_html(),

    "FOOTER_CREDITS": ("Built on Node 18 and nothing else. The SKILL.md format is the Agent Skills "
                       "open standard. Research citations for every claim on this page are in "
                       "docs/sources.md in the repository, including the ones I could not verify "
                       "and therefore did not make."),
    "FOOTER_NOTE": ("A personal open-source project. Views expressed are my own and do not "
                    "represent Microsoft's official position."),
    "AUTHOR_BIO": ("Built by Ragnar Pitla, a principal program manager and agent developer. He "
                   "ships AI agents into enterprise systems, and teaches other people to build "
                   "their own."),
}


def main():
    html = TPL.read_text(encoding="utf-8")
    for key, val in VALUES.items():
        html = html.replace("{{" + key + "}}", val)

    left = sorted(set(re.findall(r"\{\{([A-Z_0-9]+)\}\}", html)))
    if left:
        print("UNFILLED PLACEHOLDERS: " + ", ".join(left), file=sys.stderr)
        return 1

    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({len(html.splitlines())} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
