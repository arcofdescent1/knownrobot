import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Reproduction Sprints — Known Robot",
  description: "Join a two-week, multi-hardware reproduction study and publish compatibility evidence with the robotics community.",
};

const applyUrl = "https://github.com/arcofdescent1/knownrobot/issues/new?template=sprint-application.yml";
const evidenceUrl = "https://github.com/arcofdescent1/knownrobot/issues/new?template=sprint-evidence.yml";

export default function SprintsPage() {
  return <>
    <SiteHeader />
    <main className="sprints-page">
      <section className="sprint-hero">
        <div className="sprint-status"><i></i> Applications open · closes September 18</div>
        <p className="kicker">REPRODUCTION SPRINT 01 · SEPT 21–OCT 4</p>
        <h1>One policy.<br/>Different hardware.<br/><em>Public evidence.</em></h1>
        <p className="editorial-deck">Three to five teams get two weeks to reproduce the same ACT pick-and-place policy. Successful, failed, blocked, and unsafe-to-continue attempts all become part of one reviewed report.</p>
        <div className="sprint-hero-actions"><a className="primary-link sprint-apply" href={applyUrl}>Apply with your configuration ↗</a><a href="/reproduction-sprints.ics">Add both sessions to calendar ↓</a></div>
      </section>

      <section className="sprint-brief" aria-labelledby="brief-title">
        <div className="brief-heading"><p className="section-number">01 / THE ARTIFACT</p><h2 id="brief-title">ACT SO-101 Pick-and-Place</h2><p>A public LeRobot policy trained for cube pick-and-place at 30 Hz. The immutable Hub revision will be frozen when teams are announced.</p></div>
        <dl className="artifact-facts">
          <div><dt>Policy</dt><dd><a href="https://huggingface.co/legalaspro/act-so101-pick-place-cube-30hz-dec7-v2">legalaspro / act-so101…v2 ↗</a></dd></div>
          <div><dt>Architecture</dt><dd>Action Chunking with Transformers</dd></div>
          <div><dt>Declared robot</dt><dd>SO-101 · 30 Hz</dd></div>
          <div><dt>Training data</dt><dd><a href="https://huggingface.co/datasets/legalaspro/so101-pick-and-place-cube-lerobot-30hz">SO-101 pick-and-place cube ↗</a></dd></div>
          <div><dt>License</dt><dd>Apache-2.0</dd></div>
          <div><dt>Comparison</dt><dd>Compatibility, not a leaderboard</dd></div>
        </dl>
      </section>

      <section className="sprint-timeline">
        <p className="section-number">02 / SHARED CLOCK · AMERICA/DENVER</p>
        <h2>Two weeks from protocol freeze to evidence.</h2>
        <ol>
          <li className="current"><time>SEP 08–18</time><strong>Applications</strong><span>Teams declare their hardware, sensors, constraints, and publishable commitment.</span></li>
          <li><time>SEP 20</time><strong>Selection + freeze</strong><span>Three to five diverse configurations are selected; the artifact revision is frozen.</span></li>
          <li><time>SEP 21 · 10:00</time><strong>Public kickoff</strong><span>Task, reset, success predicate, safety boundary, and open questions are recorded.</span></li>
          <li><time>SEP 21–OCT 04</time><strong>Independent runs</strong><span>Teams publish evidence as soon as they complete or become blocked.</span></li>
          <li><time>OCT 05–07</time><strong>Evidence review</strong><span>Reviewers check identity, configuration, counts, deviations, and links.</span></li>
          <li><time>OCT 08 · 10:00</time><strong>Public results</strong><span>Teams compare failures, correct the record, and nominate product changes.</span></li>
          <li><time>OCT 12</time><strong>Joint report</strong><span>Results, credits, compatibility failures, and resulting issues are published.</span></li>
        </ol>
      </section>

      <section className="sprint-contract">
        <div><p className="section-number">03 / PARTICIPATION CONTRACT</p><h2>What every selected team commits to.</h2></div>
        <div className="contract-grid">
          <article><span>01</span><h3>Declare first</h3><p>Publish the robot, gripper, cameras, calibration method, compute, versions, rate, task reset, and success rule before counted trials.</p></article>
          <article><span>02</span><h3>Report every outcome</h3><p>Submit planned, completed, and successful trial counts. Identify interventions, exclusions, deviations, and the first decisive failure.</p></article>
          <article><span>03</span><h3>Keep evidence portable</h3><p>Commit a <code>robot-skill.yaml</code> beside the policy or evaluation artifact and link an immutable revision.</p></article>
          <article><span>04</span><h3>Operate safely</h3><p>Own your risk assessment and emergency stop. No people enter the operating envelope, and uncertain motion ends the attempt.</p></article>
        </div>
      </section>

      <section className="outcome-map">
        <div><p className="section-number">04 / NOTHING DISAPPEARS</p><h2>Failure is a first-class result.</h2><p>A team does not need a successful task completion to finish the sprint. The joint report preserves where the workflow stopped and why.</p></div>
        <div>
          {[["Completed", "Trials and comparable evidence"],["Task failed", "Policy ran; success predicate was not met"],["Incompatible", "A declared contract prevented execution"],["Unsafe", "Team stopped before risking hardware or people"]].map(([name,copy])=><div key={name}><i></i><strong>{name}</strong><span>{copy}</span></div>)}
        </div>
      </section>

      <section className="sprint-links">
        <div><p className="kicker">RUN WITH US</p><h2>Bring a configuration that teaches the group something.</h2><p>Applications are selected for hardware and sensing diversity, not expected success. At least two teams will run physical hardware.</p></div>
        <div>
          <a className="primary-link lime" href={applyUrl}>Apply by September 18 ↗</a>
          <a href={evidenceUrl}>Submit sprint evidence →</a>
          <a href="https://github.com/arcofdescent1/knownrobot/discussions/2">Join the sprint discussion →</a>
          <a href="https://github.com/arcofdescent1/knownrobot/blob/main/community/sprints/README.md">Read the operating handbook →</a>
          <a href="https://meet.jit.si/KnownRobotSprint01">Open the public session room →</a>
        </div>
      </section>
    </main>
  </>;
}
