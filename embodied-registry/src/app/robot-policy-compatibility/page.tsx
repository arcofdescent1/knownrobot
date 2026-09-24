import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { pageMetadata, siteOrigin } from "@/lib/seo";

const path = "/robot-policy-compatibility";
const title = "LeRobot Policy Compatibility for SO-100 and SO-101 — Known Robot";
const description = "Check the hardware, sensors, calibration, action schema, runtime and evaluation evidence behind a LeRobot policy before attempting it on an SO-100 or SO-101 arm.";
export const metadata: Metadata = pageMetadata(path, title, description);

const factors = [
  ["Pinned policy", "Identify the exact repository, checkpoint and framework revision. A model name or mutable branch is not a reproducible artifact."],
  ["Robot and gripper", "Compare the robot family, actuator and firmware assumptions, end effector, physical modifications and safety limits."],
  ["Cameras and calibration", "Match camera roles, placement, resolution, preprocessing and calibration method—not merely the number of RGB inputs."],
  ["Observation and action contract", "Verify feature names, joint order, units, normalization, coordinate frames and tensor shapes. Equal shapes do not prove equal meaning."],
  ["Control runtime", "Check control frequency, inference latency, compute, drivers and dependencies that affect closed-loop behavior."],
  ["Evaluation protocol", "Require the reset procedure, success predicate, timeout, trials, interventions, failures and execution environment behind any reported rate."],
] as const;

export default function RobotPolicyCompatibilityPage() {
  const url = `${siteOrigin}${path}`;
  return <main><SiteHeader/><StructuredData value={[
    { "@context": "https://schema.org", "@type": "WebPage", name: title, description, url, isPartOf: { "@type": "WebSite", name: "Known Robot", url: siteOrigin }, about: ["LeRobot", "SO-100 robot arm", "SO-101 robot arm", "robot policy compatibility", "robot policy reproducibility"] },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Known Robot", item: siteOrigin },
      { "@type": "ListItem", position: 2, name: "Robot policy compatibility", item: url },
    ] },
  ]}/><article className="editorial-page">
    <header className="editorial-hero"><p className="kicker">LEROBOT · SO-100 · SO-101</p><h1>Will this robot policy work on my hardware?</h1><p className="editorial-deck">KnownRobot helps you inspect the conditions behind a published LeRobot policy before spending days integrating it. Compare the declared hardware and software contract, find missing evidence, and see measured attempts when independent teams have published them.</p></header>

    <section className="editorial-section"><p className="section-number">01</p><div><h2>Compatibility is more than a matching robot name</h2><p>A policy trained for an SO-101 can still fail on another SO-101 because calibration, camera placement, observation features, action conventions, control timing or task setup changed. KnownRobot makes those assumptions explicit without claiming that metadata alone proves physical transfer.</p><p><Link href="/validator">Run the robot-policy validator →</Link> to inventory a repository and create a portable <code>robot-skill.yaml</code>.</p></div></section>

    <section className="editorial-section"><p className="section-number">02</p><div><h2>Six questions to answer before the robot moves</h2><div className="criteria-grid">{factors.map(([heading, copy]) => <div key={heading}><strong>{heading}</strong><p>{copy}</p></div>)}</div></div></section>

    <section className="editorial-section"><p className="section-number">03</p><div><h2>What KnownRobot can tell you today</h2><p>The open validator can identify declared configuration, generate a reproducibility manifest, and report missing or conflicting metadata. The local evaluator can produce measured simulator evidence. The registry connects published attempts for the same immutable policy revision so successes, failures and blocked attempts can accumulate into a compatibility history.</p><p>The registry does not yet contain enough independent evidence to promise that a particular policy will work on your arm. A clean validation result is not a physical evaluation, independent reproduction or safety certification.</p></div></section>

    <section className="editorial-section"><p className="section-number">04</p><div><h2>Use KnownRobot before an integration attempt</h2><ol className="process-list"><li><strong>Inspect</strong><span>Run the validator against the policy repository and preserve the missing-evidence report.</span></li><li><strong>Compare</strong><span>Describe your robot, gripper, sensors, calibration and runtime as named features—not anonymous shapes.</span></li><li><strong>Evaluate</strong><span>Use a fixed task, reset and success protocol. Keep failed, blocked and unsafe-to-continue outcomes.</span></li><li><strong>Publish</strong><span>Attach the manifest and evidence to immutable repository revisions, then submit the attempt to KnownRobot.</span></li></ol></div></section>

    <section className="decision-box"><div><p className="kicker">START WITH YOUR REAL POLICY</p><h2>Document one transfer attempt from repository to result.</h2></div><Link href="/participate">Get hands-on help →</Link></section>
  </article></main>;
}
