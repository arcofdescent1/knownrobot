import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { publicTerms } from "@/components/public-vocabulary";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/terms", "Artifacts, evidence, assessments, and reproductions — Known Robot", "The four public concepts used across KnownRobot, with practical robotics examples and clear boundaries.");

const examples: Record<string, string> = {
  Artifact: "An ACT checkpoint, a LeRobot dataset, an SO-101 configuration, or its supporting software repository.",
  Evidence: "Trial counts, observed failures, calibration details, videos, logs, and the protocol under which they were produced.",
  Assessment: "A non-executing inspection of a pinned repository that reports declared metadata, missing fields, and uncertainty.",
  Reproduction: "A separate team independently runs the same pinned artifact and protocol, then publishes its own evidence.",
};

export default function TermsPage() {
  return <><SiteHeader/><main className="editorial-page terms-page"><header className="editorial-hero"><p className="kicker">PLAIN LANGUAGE</p><h1>Four words. Four different claims.</h1><p>KnownRobot keeps the thing, the observation, the metadata review, and the independent repeat separate. That prevents a repository description from becoming a measured result—and prevents one team&apos;s result from becoming universal compatibility.</p></header><div className="terms-grid">{publicTerms.map(({ term, definition }, index) => <section key={term}><span>0{index + 1}</span><h2>{term}</h2><p><strong>{definition}</strong></p><p>{examples[term]}</p></section>)}</div><section className="terms-example"><h2>How they connect</h2><p>A contributor imports an <strong>artifact</strong>. KnownRobot can publish an <strong>assessment</strong> of its metadata without running it. A practitioner can then publish <strong>evidence</strong> from actual use. When an independent practitioner tries to repeat a reported result, that work is a <strong>reproduction</strong>.</p><div><Link className="primary-link" href="/discover">Discover artifacts →</Link><Link href="/assessments">Browse assessments</Link></div></section></main></>;
}
