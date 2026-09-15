import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "robot-skill validator — Known Robot",
  description: "Inspect a robot-policy repository, generate a portable manifest, and find the evidence another team would need to reproduce it.",
};

const install = "pipx install git+https://github.com/arcofdescent1/knownrobot.git@v1.1.0";

export default function ValidatorPage() {
  return <>
    <SiteHeader />
    <main className="validator-page">
      <section className="validator-hero">
        <div>
          <p className="kicker">OPEN UTILITY · VERSION 1.0</p>
          <h1>Find what is missing before the robot moves.</h1>
          <p className="editorial-deck">Run one command inside an existing policy repository. The validator inventories reproducibility evidence, writes a portable <code>robot-skill.yaml</code>, and tells you exactly what another team would still need.</p>
        </div>
        <div className="terminal-card" aria-label="Validator command example">
          <div className="terminal-bar"><span></span><span></span><span></span><b>policy / terminal</b></div>
          <pre><span>$</span> robot-skill check ./policy --strict{`\n\n`}INCOMPLETE  ./policy{`\n`}Detected 4 evidence files{`\n`}ERROR  policy.framework_version{`\n`}  Pin the framework version.{`\n`}ERROR  hardware.gripper{`\n`}  Declare the end effector.{`\n`}WARN   evaluations{`\n`}  Compatibility remains unverified.</pre>
        </div>
      </section>

      <section className="quickstart" aria-labelledby="quickstart-title">
        <div><p className="section-number">01 / QUICKSTART</p><h2 id="quickstart-title">From repository to manifest</h2></div>
        <ol className="command-steps">
          <li><span>1</span><div><strong>Install</strong><code>{install}</code></div></li>
          <li><span>2</span><div><strong>Inspect a policy</strong><code>robot-skill check ./policy</code></div></li>
          <li><span>3</span><div><strong>Use it in CI</strong><code>robot-skill check . --strict --no-write</code></div></li>
        </ol>
        <p className="platform-note">Python 3.10–3.12 · macOS, Linux, and Windows · Apache-2.0</p>
      </section>

      <section className="coverage-section">
        <div><p className="section-number">02 / EVIDENCE CONTRACT</p><h2>One file. Eight evidence groups.</h2><p>The manifest stays beside the policy on GitHub or Hugging Face. Null values are allowed structurally so the first scan can be saved; strict mode fails until every required claim is supplied.</p></div>
        <div className="coverage-grid">
          {[
            ["Policy", "Framework, pinned version, architecture, checkpoint"],
            ["Hardware", "Robot family, gripper, sensors, calibration references"],
            ["Runtime", "Control frequency, observation and action shapes"],
            ["Dataset", "Repository, revision, feature schema, license"],
            ["Dependencies", "Detected lockfiles and environment declarations"],
            ["Source", "Repository type, immutable revision, artifact version"],
            ["Compatibility", "Supported, unsupported, and untested hardware"],
            ["Evaluation", "Benchmark, trials, successes, evaluator, evidence"],
          ].map(([title, copy], index) => <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><strong>{title}</strong><p>{copy}</p></div>)}
        </div>
      </section>

      <section className="behavior-section">
        <p className="section-number">03 / RELIABLE AUTOMATION</p>
        <h2>Designed to fail usefully.</h2>
        <div className="behavior-grid">
          <div><strong>Exit 0</strong><p>The scan ran. In default mode, an incomplete draft is still written so contributors can improve it.</p></div>
          <div><strong>Exit 1</strong><p>The path, manifest, or filesystem could not be read. No misleading output is written.</p></div>
          <div><strong>Exit 2</strong><p>Strict mode found missing required evidence or the existing manifest violated the schema.</p></div>
          <div><strong>JSON diagnostics</strong><p><code>--format json</code> returns stable finding codes, paths, severities, and a summary for CI.</p></div>
        </div>
      </section>

      <section className="validator-actions">
        <div><p className="kicker">STANDARDIZE IN THE OPEN</p><h2>Use the format without joining a platform.</h2><p>The schema, example, implementation, and tests are public. Keep the manifest with your policy and review it like code.</p></div>
        <div>
          <a className="primary-link lime" href="https://github.com/arcofdescent1/knownrobot/tree/v1.1.0#robot-skill-validator">Read the CLI guide ↗</a>
          <a href="https://raw.githubusercontent.com/arcofdescent1/knownrobot/v1.1.0/embodied-registry/schema/robot-skill.schema.json">Download schema 1.0 ↗</a>
          <Link href="/participate">Report a transfer failure →</Link>
        </div>
      </section>
    </main>
  </>;
}
