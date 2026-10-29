import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PublicVocabulary } from "@/components/public-vocabulary";
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
    <header className="editorial-hero"><p className="kicker">EXTERNAL ARTIFACT ASSESSMENTS</p><h1>What the metadata establishes—and what it does not.</h1><p>An assessment inspects a pinned artifact&apos;s source metadata without executing it. KnownRobot publishes the generated manifest, missing-information report, attribution, and uncertainty. An assessment is not evidence or a compatibility result.</p></header>
    <PublicVocabulary compact />
    <section><h2>Assessment boundaries</h2><ul><li>No policy code, checkpoint, or robot command is executed.</li><li>Upstream performance statements remain attributed model-card claims.</li><li>An assessment never creates trials, evidence, or compatibility conclusions.</li><li>Observed or measured results become evidence only after attributable simulation or physical execution.</li></ul></section>
    <section><h2>Published assessments</h2><p><small>Publication source: {state === "database" ? "append-only assessment registry" : "auditable source export"}.</small></p><div className="assessment-list">{records.map(record => <article key={record.slug}><p className="kicker">METADATA ONLY · {record.assessment.status.toUpperCase()}</p><h3><Link href={`/assessments/${record.slug}`}>{record.title}</Link></h3><p>{record.summary}</p><p><strong>Artifact intent:</strong> {record.assessment.artifact_intents.map(intent => artifactIntentLabels[intent]).join(" · ")} <small>(descriptive only)</small></p><p><strong>Source:</strong> {record.source.repository} · <code>{record.source.revision.slice(0, 12)}</code> · {record.source.license}</p><p>{record.findings.errors.length} missing requirements · {record.findings.warnings.length} cautions · no evaluation performed</p></article>)}</div></section>
    <section><h2>Why publish incomplete assessments?</h2><p>A useful assessment reveals uncertainty instead of laundering metadata into a compatibility claim. These examples cover a simulation artifact, a physically documented artifact whose results remain upstream claims, and a base checkpoint that still needs task-specific adaptation and evidence.</p><Link href="/validator">Assess an artifact&apos;s metadata →</Link></section>
  </main></>;
}
