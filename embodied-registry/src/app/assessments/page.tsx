import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { artifactIntentLabels } from "@/lib/external-assessment";
import { listExternalPolicyAssessments } from "@/lib/external-assessment-reader";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("/assessments", "External Robot Policy Metadata Assessments — Known Robot", "Inspect pinned Hugging Face policy metadata, portable manifests and missing-information reports without confusing validation with measured evaluation.");

export const dynamic = "force-dynamic";
export default async function AssessmentsPage() {
  const { records, state } = await listExternalPolicyAssessments();
  return <><SiteHeader /><main className="evidence-page">
    <StructuredData value={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "External robot policy metadata assessments", url: "https://knownrobot.com/assessments", description: "Pinned, non-executing metadata assessments of externally authored robot policies." }} />
    <header className="editorial-hero"><p className="kicker">EXTERNAL POLICY ASSESSMENTS</p><h1>What the metadata establishes—and what it does not.</h1><p>Known Robot inspects a pinned upstream revision with the non-executing validator, publishes the generated manifest and missing-information report, and preserves author and license attribution. These records are not evaluations or compatibility results.</p></header>
    <section><h2>Assessment boundaries</h2><ul><li>No policy code, checkpoint or robot command is executed.</li><li>Upstream performance statements remain attributed model-card claims.</li><li>An assessment never creates trials, verification status or compatibility graph edges.</li><li>A measured evaluation becomes a separate record only after actual simulation execution or attributable physical evidence.</li></ul></section>
    <section><h2>Published assessments</h2><p><small>Publication source: {state === "database" ? "append-only assessment registry" : "auditable source export"}.</small></p><div className="assessment-list">{records.map(record => <article key={record.slug}><p className="kicker">METADATA ONLY · {record.assessment.status.toUpperCase()}</p><h3><Link href={`/assessments/${record.slug}`}>{record.title}</Link></h3><p>{record.summary}</p><p><strong>Artifact intent:</strong> {record.assessment.artifact_intents.map(intent => artifactIntentLabels[intent]).join(" · ")} <small>(descriptive only)</small></p><p><strong>Source:</strong> {record.source.repository} · <code>{record.source.revision.slice(0, 12)}</code> · {record.source.license}</p><p>{record.findings.errors.length} missing requirements · {record.findings.warnings.length} cautions · no evaluation performed</p></article>)}</div></section>
    <section><h2>Why publish incomplete examples?</h2><p>A useful validator should reveal uncertainty instead of laundering it into a compatibility claim. These contrasting records show a simulation policy, a physically documented policy whose results remain upstream claims, and a base checkpoint that still needs task-specific fine-tuning and evaluation.</p><Link href="/validator">Run the validator on your policy →</Link></section>
  </main></>;
}
