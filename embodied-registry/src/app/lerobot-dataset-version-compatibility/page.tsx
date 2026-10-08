import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { pageMetadata, siteOrigin } from "@/lib/seo";

const path = "/lerobot-dataset-version-compatibility";
const title = "LeRobot Dataset Version Compatibility: v2.1 vs v3.0 — Known Robot";
const description = "Diagnose LeRobot dataset version mismatches, understand v2.1 and v3.0 compatibility, and preserve the exact dataset and runtime revisions used by a robot policy.";
const url = `${siteOrigin}${path}`;

export const metadata: Metadata = pageMetadata(path, title, description);

const rows = [
  ["v2.1", "LeRobot 0.3.3-era tooling", "Legacy workflow", "Pin the working package and dataset revisions before changing either."],
  ["v2.1", "LeRobot 0.4.0 and later", "Conversion normally required", "Expect the v2.1-to-v3.0 conversion path rather than assuming the old dataset will load unchanged."],
  ["v3.0", "LeRobot 0.4.0 and later", "Current native format", "Still pin the exact package, dataset commit and metadata hashes; format compatibility does not prove policy compatibility."],
  ["Newer dataset minor", "Older codebase minor", "Forward-compatibility risk", "Do not rely solely on the current warning text. Inspect both versions and update only after reviewing upstream changes."],
  ["Newer dataset major", "Older codebase major", "Treat as incompatible", "Stop and verify upstream migration guidance. A current open bug reports that this case can be silent."],
] as const;

const faqs = [
  { q: "Is the LeRobot package version the same as the dataset-format version?", a: "No. A package such as LeRobot 0.6.x can read a dataset whose metadata declares format v3.0. Record both values separately." },
  { q: "Can I load a LeRobot v2.1 dataset with current LeRobot?", a: "Current LeRobot workflows generally require the official v2.1-to-v3.0 conversion path. Preserve the original dataset revision before converting it." },
  { q: "Does converting a dataset preserve its identity?", a: "No. Conversion creates a derived artifact. Record the original revision, conversion tool and version, command or configuration, output revision and file hashes." },
  { q: "Does a compatible dataset format prove that a policy will work?", a: "No. Dataset-format compatibility does not establish matching features, normalization, calibration, action semantics, runtime behavior or task success." },
] as const;

export default function LeRobotDatasetVersionCompatibilityPage() {
  return <main><SiteHeader/><StructuredData value={[
    { "@context": "https://schema.org", "@type": "TechArticle", headline: "LeRobot dataset version compatibility: v2.1 vs v3.0", description, datePublished: "2026-10-07", dateModified: "2026-10-07", mainEntityOfPage: url, url, author: { "@type": "Organization", name: "Known Robot", url: siteOrigin }, publisher: { "@type": "Organization", name: "Known Robot", url: siteOrigin }, about: ["LeRobotDataset v2.1", "LeRobotDataset v3.0", "robot dataset compatibility", "robot policy reproducibility"] },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Known Robot", item: siteOrigin },
      { "@type": "ListItem", position: 2, name: "LeRobot dataset version compatibility", item: url },
    ] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ]}/><article className="editorial-page">
    <header className="editorial-hero"><p className="kicker">LEROBOT DATASETS · VERSION DIAGNOSTIC</p><h1>LeRobot dataset v2.1 or v3.0: what will load?</h1><p className="editorial-deck">Separate the dataset-format version from the installed LeRobot package, diagnose version mismatches, and preserve provenance before converting an artifact.</p></header>

    <section className="editorial-section"><p className="section-number">01</p><div><h2>Start with two different version numbers</h2><p>LeRobot’s package release and a dataset’s <code>codebase_version</code> describe different things. A dataset can declare format <code>v3.0</code> while the installed Python package is <code>0.6.x</code>. Capture both, plus the immutable dataset revision, before diagnosing a failure.</p><p>A fresh <a href="https://github.com/huggingface/lerobot/issues/4851">upstream bug report</a> shows why this matters: the current compatibility check can display a newer-dataset warning for an older dataset and remain silent for a newer one. Until that behavior is resolved, verify the values directly rather than trusting the warning text alone.</p></div></section>

    <section className="editorial-section"><p className="section-number">02</p><div><h2>Compatibility decision table</h2><div className="table-wrap"><table><thead><tr><th>Dataset format</th><th>Installed code</th><th>Expected decision</th><th>Next step</th></tr></thead><tbody>{rows.map(([dataset, code, decision, next]) => <tr key={`${dataset}-${code}`}><td><code>{dataset}</code></td><td>{code}</td><td>{decision}</td><td>{next}</td></tr>)}</tbody></table></div><p>This table is a diagnostic guide, not a substitute for the version-specific upstream release notes. A readable dataset can still be semantically incompatible with a policy.</p></div></section>

    <section className="editorial-section"><p className="section-number">03</p><div><h2>Before conversion, preserve the source</h2><ul><li>Repository and full immutable commit SHA.</li><li>Dataset <code>codebase_version</code> from metadata.</li><li>Installed LeRobot package version and source revision.</li><li>Hashes for metadata, task indexes and episode indexes.</li><li>The original license, authorship and collection attribution.</li></ul><p>Conversion creates a derived artifact. Record the converter command and version, configuration, output revision, file hashes, warnings and any dropped or rewritten fields. Never overwrite the only copy of the source dataset.</p></div></section>

    <section className="editorial-section"><p className="section-number">04</p><div><h2>Format compatibility is not policy compatibility</h2><p>Successfully opening the files does not establish that the policy receives the features it expects. Compare camera names, observation and action schemas, shapes, units, normalization statistics, timestamps, frame rate and task labels. Then preserve the runtime, calibration and evaluation protocol separately.</p><p><Link href="/field-notes/what-a-lerobot-evaluation-dataset-proves">Read what an evaluation dataset proves—and what it does not →</Link></p></div></section>

    <section className="editorial-section"><p className="section-number">05</p><div><h2>Frequently asked questions</h2>{faqs.map(({ q, a }) => <div key={q}><h3>{q}</h3><p>{a}</p></div>)}</div></section>

    <section className="editorial-section"><p className="section-number">SOURCES</p><div><h2>Primary evidence</h2><ul><li><a href="https://github.com/huggingface/lerobot/issues/4851">LeRobot issue #4851: version compatibility warning direction</a></li><li><a href="https://github.com/huggingface/lerobot/issues/3138">LeRobot issue #3138: dataset metadata and package-version confusion</a></li><li><a href="https://dev.classmethod.jp/articles/lerobot-dataset-so-arm101/">SO-ARM101 comparison of LeRobot dataset v2.1 and v3.0</a></li></ul></div></section>

    <section className="decision-box"><div><p className="kicker">PRESERVE THE ARTIFACT</p><h2>Have a public dataset or evaluation bundle with a version mismatch?</h2></div><Link href="/participate">Submit the immutable artifact →</Link></section>
  </article></main>;
}
