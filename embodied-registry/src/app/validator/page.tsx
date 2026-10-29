import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { WebValidator } from "@/components/web-validator";

export const metadata: Metadata = pageMetadata("/validator", "Validate a GitHub or Hugging Face Robot Policy — Known Robot", "Paste a public GitHub or Hugging Face URL to inspect pinned robot-policy metadata, identify reproducibility gaps, and continue with deeper CLI validation.");

const install = "pipx install .  # from the Known Robot 1.6.0 checkout";

export default function ValidatorPage() {
  return <>
    <SiteHeader />
    <main className="validator-page">
      <StructuredData value={{ "@context": "https://schema.org", "@type": "WebApplication", name: "Known Robot robot-policy validator", url: "https://knownrobot.com/validator", applicationCategory: "DeveloperApplication", operatingSystem: "Any", browserRequirements: "JavaScript-enabled browser", softwareVersion: "1.6.0", description: "Interactive metadata-only validation for public GitHub and Hugging Face robotics artifacts, with an open-source CLI for deeper local and CI checks.", featureList: ["Immutable source revision resolution", "Approved metadata inspection", "Readable reproducibility-gap report", "GitHub and Hugging Face support"], offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, license: "https://www.apache.org/licenses/LICENSE-2.0", codeRepository: "https://github.com/arcofdescent1/knownrobot" }}/>
      <section className="validator-hero">
        <div>
          <p className="kicker">WEB VALIDATOR · NO ACCOUNT REQUIRED</p>
          <h1>Paste a robot repository. Find the reproducibility gaps.</h1>
          <p className="editorial-deck">Inspect a public GitHub or Hugging Face repository before attempting reproduction. KnownRobot pins the source revision, reads approved metadata only, and turns missing declarations into clear next steps. Configuration review never proves physical transfer or safe operation.</p>
        </div>
        <div className="terminal-card" aria-label="Validator command example">
          <div className="terminal-bar"><span></span><span></span><span></span><b>policy / terminal</b></div>
          <pre><span>$</span> robot-skill check ./policy --strict{`\n\n`}INCOMPLETE  ./policy{`\n`}Detected 4 evidence files{`\n`}ERROR  policy.framework_version{`\n`}  Pin the framework version.{`\n`}ERROR  hardware.gripper{`\n`}  Declare the end effector.{`\n`}WARN   evaluations{`\n`}  Compatibility remains unverified.</pre>
        </div>
      </section>

      <WebValidator />

      <section className="quickstart" aria-labelledby="quickstart-title">
        <div><p className="section-number">CLI / DEEPER VALIDATION</p><h2 id="quickstart-title">Need local files, CI, or a portable manifest?</h2></div>
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
            ["Dependencies", "Resolved package versions and hashed declarations"],
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
          <div><strong>Exit 2</strong><p>Invalid evidence always fails. Strict or complete validation also fails on missing metadata; target comparison fails on mismatches or unknowns.</p></div>
          <div><strong>JSON diagnostics</strong><p><code>--format json</code> returns stable finding codes, paths, severities, and a summary for CI.</p></div>
        </div>
        <p>Use <code>--target ./target.yaml --no-write --format json</code> to compare declared configurations. Equal shapes alone are not sufficient: feature semantics and calibration matter. A match never establishes safe physical transfer or independent reproduction.</p>
      </section>

      <section className="behavior-section" id="measured-evaluation">
        <p className="section-number">04 / MEASURED SIMULATION</p>
        <h2>Run the policy. Preserve every outcome.</h2>
        <p>The separate local evaluator executes actual policy inference in <code>FetchPickAndPlace-v4</code> or <code>FetchReach-v4</code> using Gymnasium Robotics and MuJoCo. It records seeded resets, observations, actions, final simulator success signals, failures and inference latency. This is Fetch simulation evidence—not SO-101 physical compatibility or safety certification.</p>
        <pre className="evidence-json"><code>{`python -m pip install '.[evaluation]'\nrobot-skill evaluate evaluation.yaml --allow-execution --output evidence/run-01\nrobot-skill verify-evaluation evidence/run-01`}</code></pre>
        <p>Use a real Fetch manifest and actual policy artifact. Your YAML/JSON configuration declares <code>format: knownrobot-evaluation/1.0</code>, <code>environment</code>, planned <code>trials</code>, initial <code>seed</code>, <code>max_steps</code>, <code>trial_timeout_seconds</code>, a relative <code>manifest</code> path and a <code>policy</code> object containing <code>kind</code>, relative <code>path</code> and the actual file <code>sha256</code>.</p>
        <p>Policies may be NumPy MLP archives or reviewed local Python factories. Python execution additionally requires <code>--trust-policy</code>: arbitrary policy code is not sandboxed. Use an isolated environment without secrets or attached hardware. Metadata validation still never executes code.</p>
        <p>Bundles include the complete trial ledger, execution traces, input hashes, package versions and checksum inventory. Failed trials are retained. Integrity checks do not establish independent verification. Add <code>--evidence-url</code> with your chosen HTTPS bundle location to generate an eligible <code>submission.json</code>; publish the complete evidence in your existing repository and review attribution before submission.</p>
        <p><a href="https://github.com/arcofdescent1/knownrobot/blob/main/docs/evaluation.md">Complete evaluation configuration, policy interface and publication guide ↗</a> · <Link href="/submit">Submit measured evidence →</Link></p>
      </section>

      <section className="behavior-section" id="external-assessment">
        <p className="section-number">05 / EXTERNAL ASSESSMENT</p>
        <h2>Pin, inspect and publish without executing.</h2>
        <p>The admin workflow resolves or verifies a full Hugging Face commit, downloads only allowlisted metadata, inserts verified repository provenance into the generated manifest, hashes every inspected file and emits a publication-ready assessment bundle.</p>
        <pre className="evidence-json"><code>{`robot-skill assess-hf aadarshram/act_pusht \\\n  --revision 6d403b142934aaef61fc07f5eec1515c4325751f \\\n  --artifact-intent task_policy --artifact-intent simulation_policy \\\n  --output assessments/aadarshram-act-pusht`}</code></pre>
        <p>Artifact intent is descriptive only; it does not change completeness or establish compatibility. Add <code>--claims upstream-claims.json</code> for reviewed, categorized model-card paraphrases. After verification, <code>sync-assessment</code> advances the record through draft, review and published database states; <code>export-assessments</code> creates the source-controlled audit snapshot. Checkpoint weights and policy code are never downloaded or executed.</p>
      </section>

      <section className="behavior-section" id="durable-report">
        <p className="section-number">06 / DURABLE REPORT</p>
        <h2>Keep the findings with the manifest.</h2>
        <pre className="evidence-json"><code>{`robot-skill check ./policy --format assessment --output assessment.json\nrobot-skill verify-report assessment.json --policy ./policy`}</code></pre>
        <p>The report includes every diagnostic, the validator version, inspected-file hashes, provenance, declared target comparison and an explicit metadata-only execution boundary. Atomic writes do not replace existing reports unless <code>--force</code> is supplied.</p>
      </section>

      <section className="validator-actions">
        <div><p className="kicker">STANDARDIZE IN THE OPEN</p><h2>Use the format without joining a platform.</h2><p>The schema, example, implementation, and tests are public. Keep the manifest with your policy and review it like code.</p></div>
        <div>
          <a className="primary-link lime" href="https://github.com/arcofdescent1/knownrobot/blob/main/docs/validator.md">Read the CLI guide ↗</a>
          <a href="/schema/robot-skill/1.0.json">Download schema 1.0 ↗</a>
          <a href="https://github.com/arcofdescent1/knownrobot/blob/main/docs/distribution.md">Reusable GitHub Action and portable credit guide ↗</a>
          <Link href="/adapters">Inspect adapter ownership →</Link>
          <Link href="/lerobot-dataset-version-compatibility">Check LeRobot dataset-version compatibility →</Link>
          <Link href="/corrections">Corrections and disputes →</Link>
          <Link href="/participate">Report a transfer failure →</Link>
        </div>
      </section>
    </main>
  </>;
}
