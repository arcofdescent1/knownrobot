import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { externalPolicyAssessments, getExternalPolicyAssessment } from "@/lib/external-assessment";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return externalPolicyAssessments.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const record = getExternalPolicyAssessment((await params).slug);
  if (!record) notFound();
  return pageMetadata(`/assessments/${record.slug}`, `${record.title} — Known Robot`, `${record.summary} Metadata-only; no policy execution or compatibility claim.`, { article: true, published: record.assessment.assessed_at });
}
function JsonRecord({ title, value }: { title: string; value: unknown }) { return <details className="evidence-json"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>; }

export default async function AssessmentPage({ params }: Props) {
  const record = getExternalPolicyAssessment((await params).slug);
  if (!record) notFound();
  return <><SiteHeader /><main className="evidence-page">
    <StructuredData value={{ "@context": "https://schema.org", "@type": "TechArticle", headline: record.title, datePublished: record.assessment.assessed_at, author: { "@type": "Organization", name: "Known Robot" }, isBasedOn: record.source.revision_url, license: "https://www.apache.org/licenses/LICENSE-2.0", url: `https://knownrobot.com/assessments/${record.slug}` }} />
    <Link href="/assessments">← External assessments</Link>
    <div className="demo-ribbon" role="note">METADATA ASSESSMENT ONLY · NO POLICY EXECUTION · NO EVALUATION · NO COMPATIBILITY CLAIM</div>
    <header className="editorial-hero"><p className="kicker">EXTERNAL POLICY ASSESSMENT</p><h1>{record.title}</h1><p>{record.summary}</p><p>Known Robot is the metadata assessor. <strong>{record.source.author}</strong> is the attributed upstream author or organization. Known Robot is not the policy author or evaluator.</p></header>
    <dl className="evidence-facts"><div><dt>Upstream source</dt><dd><a href={record.source.repository_url} rel="noopener noreferrer">{record.source.repository} ↗</a></dd></div><div><dt>Pinned revision</dt><dd><a href={record.source.revision_url} rel="noopener noreferrer"><code>{record.source.revision}</code> ↗</a></dd></div><div><dt>License</dt><dd>{record.source.license} · as declared by the upstream repository</dd></div><div><dt>Assessment method</dt><dd><code>{record.assessment.method}</code> · validator {record.assessment.validator_version}</dd></div><div><dt>Assessment status</dt><dd>{record.assessment.status} · {record.findings.errors.length} missing requirements</dd></div><div><dt>Assessed</dt><dd><time dateTime={record.assessment.assessed_at}>{record.assessment.assessed_at.slice(0,10)} UTC</time></dd></div></dl>
    <section><h2>Evidence boundary</h2><p>The validator inspected the listed metadata files only. It did not download weights, import policy code, run inference, control hardware, execute simulation or verify model-card results.</p><JsonRecord title="Machine-readable assessment boundary" value={record.assessment} />{record.binding && <JsonRecord title="Cryptographic source and manifest binding" value={record.binding} />}</section>
    <section><h2>Evidence classification</h2><p>Each statement stays in one evidence lane. Detection is not declaration, an upstream claim is not a Known Robot measurement, and none of these lanes establishes compatibility.</p>
      <h3>Validator-detected facts</h3>{record.evidence_classes?.validator_detected_facts.length ? <ul>{record.evidence_classes.validator_detected_facts.map(item => <li key={item.path}><code>{item.path}</code> — {JSON.stringify(item.value)}</li>)}</ul> : <p>This legacy assessment does not include a field-level detection ledger. Inspect the generated manifest and file inventory.</p>}
      <h3>Portable manifest declarations</h3>{record.evidence_classes?.portable_manifest_declarations.length ? <ul>{record.evidence_classes.portable_manifest_declarations.map(item => <li key={item.path}><code>{item.path}</code> — {JSON.stringify(item.value)} · {item.basis}</li>)}</ul> : <p>The complete portable declaration is preserved in the manifest below; this legacy assessment does not include a separate declaration ledger.</p>}
      <h3>Upstream attributed claims</h3>{record.upstream_claims.length ? <ul>{record.upstream_claims.map((item, index) => <li key={index}>{item.category ? <strong>{item.category.replaceAll("_", " ")}: </strong> : null}{item.claim} <a href={item.source_url} rel="noopener noreferrer">Pinned model card ↗</a></li>)}</ul> : <p>No upstream model-card claims were authored for this assessment.</p>}
      <h3>Known Robot-measured results</h3><p>None. This metadata assessment did not execute the policy. Any future measured result must be published as a separate evaluation record.</p>
    </section>
    <section><h2>Generated portable manifest</h2><p>This is the portable metadata output, including nulls. In provenance-bound 1.4.0+ assessments, verified Hub repository and commit declarations are added explicitly and separately identified above.</p><JsonRecord title="robot-skill manifest" value={record.manifest} /><a href={`/assessments/${record.slug}/manifest.json`}>Download manifest (JSON) →</a></section>
    <section><h2>Missing-information report</h2><p>Missing declarations remain visible. Model-card prose does not silently satisfy portable metadata fields.</p><ul>{record.findings.errors.map(item => <li key={item.path}><strong><code>{item.path}</code></strong> — {item.message}</li>)}</ul><h3>Cautions</h3><ul>{record.findings.warnings.map(item => <li key={item.path}><strong><code>{item.path}</code></strong> — {item.message}</li>)}</ul><a href={`/assessments/${record.slug}/report.json`}>Download complete assessment report (JSON) →</a></section>
    <section><h2>Inspected file inventory</h2><p>Hashes make the metadata snapshot auditable without republishing upstream checkpoint weights.</p><JsonRecord title="File names, byte counts and SHA-256 digests" value={record.inspected_files} /></section>
    <section><h2>Limitations and next evidence</h2><ul>{record.limitations.map(item => <li key={item}>{item}</li>)}</ul><p>A future measured evaluation must be published as a separate evaluation record with an execution protocol, trials, outcomes and evidence. It will not overwrite or retroactively strengthen this assessment.</p></section>
  </main></>;
}
