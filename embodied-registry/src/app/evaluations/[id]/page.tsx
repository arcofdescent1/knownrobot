import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getEvaluation } from "@/lib/evaluations";
import { displayStatus, statusLabels, safeEvidenceUrl, evidenceLinks } from "@/lib/evidence-contract";
import { badgeMarkdown, declaredSourceCredits, recordUrl } from "@/lib/distribution";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getEvaluation(id);
  if (result.state === "missing") notFound();
  if (!("record" in result)) return { title: "Evaluation unavailable — Known Robot", robots: { index: false } };
  return pageMetadata(`/evaluations/${result.record.id}`, `${result.record.skill.name} — Known Robot`,
    `Published evaluation on ${result.record.hardware.robot_family}. Inspect source revisions, protocol, and attributable review history.`,
    { index: result.state !== "demo", article: true, published: result.record.published_at });
}
function JsonRecord({ title, value }: { title: string; value: unknown }) {
  return <details className="evidence-json"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>;
}
export default async function EvaluationPage({ params }: Props) {
  const { id } = await params;
  const result = await getEvaluation(id);
  if (result.state === "missing") notFound();
  if (!("record" in result)) return <><SiteHeader /><main className="evidence-page"><section className="empty-state" role="alert"><h1>{result.state === "unconfigured" ? "Evidence collection is not connected yet" : "Evidence temporarily unavailable"}</h1><p>We cannot retrieve this record. No example evidence is substituted.</p><Link href={`/evaluations/${id}`}>Try again</Link> · <Link href="/">Registry</Link></section></main></>;
  const { record, related } = result;
  const example = result.state === "demo";
  const sourceUrl = safeEvidenceUrl(record.skill.source_url);
  const protocolUrl = safeEvidenceUrl(record.benchmark.source_url);
  const links = evidenceLinks(record);
  const status = displayStatus(record);
  const sourceCredits = declaredSourceCredits(record);
  return <><SiteHeader /><main className="evidence-page">
    <Link href="/">← Registry</Link>
    {example && <div className="demo-ribbon" role="note">FICTIONAL FORMAT EXAMPLE · Not real robot evidence. Do not cite this as a performance result.</div>}
    <header className="editorial-hero"><p className="kicker">PUBLISHED EVALUATION</p><h1>{record.skill.name}</h1><p>{record.skill.summary}</p><span className="status amber">{statusLabels[status]}</span><p>{status === "self_tested" ? "Contributor-reported outcome; independent reproduction is not established." : "This status is backed by an attributable review decision below. It is not a guarantee of safe transfer to another configuration."}</p>
      {!record.review_consistent && <p role="alert">Verification history does not match the current record. Stronger status is withheld.</p>}
    </header>
    <dl className="evidence-facts"><div><dt>Tested on</dt><dd>{record.hardware.robot_family}</dd></div><div><dt>Reported success</dt><dd>{record.evaluation.success_rate === null ? "Not reported" : `${record.evaluation.success_rate}%`} · {record.evaluation.trial_count} trials</dd></div><div><dt>Evaluator</dt><dd>{record.submitter.display_name ?? record.submitter.handle ?? "Unnamed contributor"}<br /><code>{record.submitter.id}</code></dd></div><div><dt>Published</dt><dd><time dateTime={record.published_at}>{new Date(record.published_at).toISOString().slice(0,10)} UTC</time></dd></div><div><dt>Policy revision</dt><dd><code>{record.skill.source_revision}</code></dd></div><div><dt>Result digest</dt><dd><code>{record.evaluation.result_digest}</code></dd></div></dl>
    <section><h2>Artifact and configuration</h2><p>{sourceUrl && !example ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Open source repository ↗</a> : "No live source link is provided."} · Framework: {record.skill.framework} · License: {record.skill.license ?? "Not recorded"}</p><p>A repository URL may point to a mutable branch. Use the recorded immutable revision when reproducing.</p><JsonRecord title="Hardware, gripper, sensors, and calibration" value={record.hardware.configuration} /><JsonRecord title="Runtime, feature contracts, dependencies, and trial record" value={record.evaluation.runtime} /><JsonRecord title="Policy manifest and dataset provenance" value={record.skill.manifest} /><a href={`/evaluations/${id}/manifest.json`}>Download policy manifest (JSON)</a></section>
    <section><h2>Evaluation protocol</h2><p>{record.benchmark.name} · version {record.benchmark.version}</p>{protocolUrl && <a href={protocolUrl} target="_blank" rel="noopener noreferrer">Protocol source ↗</a>}<JsonRecord title="Declared protocol" value={record.benchmark.protocol} />{["reset", "success_predicate", "intervention_policy", "timeout"].map(field => <p key={field}><strong>{field.replaceAll("_", " ")}: </strong>{field in record.benchmark.protocol ? JSON.stringify(record.benchmark.protocol[field]) : "Not supplied in the protocol. Do not assume equivalence with another evaluation."}</p>)}</section>
    <section><h2>Outcomes and failures</h2><p><strong>Outcome: </strong>{record.evaluation.runtime.outcome ? JSON.stringify(record.evaluation.runtime.outcome) : "Not separately recorded; inspect the reported trial data."}</p><JsonRecord title="Failure, intervention, exclusion, and deviation records" value={{ failures: record.evaluation.runtime.failures ?? "Not supplied", interventions: record.evaluation.runtime.interventions ?? "Not supplied", exclusions: record.evaluation.runtime.exclusions ?? "Not supplied", deviations: record.evaluation.runtime.deviations ?? "Not supplied" }} /><p>A success percentage is contributor-reported, not a reconstructed count of successful trials. Missing failures do not mean no failures occurred.</p></section>
    <section><h2>Evidence artifacts</h2>{links.length ? <ul>{links.map((link, index) => <li key={index}>{link.url ? <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a> : <span>{link.label}: non-link reference — {JSON.stringify(link.reference)}</span>}</li>)}</ul> : <p>No evidence artifacts were supplied. This record alone cannot support independent reproduction.</p>}<JsonRecord title="Raw evidence references" value={record.evaluation.evidence} /></section>
    <section><h2>Review and correction history</h2>{!record.reviews.length && <p>No authenticated review decisions have been recorded.</p>}<ol className="review-history">{record.reviews.map(review => <li key={review.id}><h3>{statusLabels[review.previous_status]} → {statusLabels[review.new_status]}</h3><p>Decision {review.review_version} · {review.reviewer_identity.display_name ?? review.reviewer_identity.handle ?? review.reviewer_id} · <time dateTime={review.created_at}>{new Date(review.created_at).toISOString()}</time></p><p>{review.rationale}</p>{safeEvidenceUrl(review.evidence_url) && <a href={safeEvidenceUrl(review.evidence_url)!} target="_blank" rel="noopener noreferrer">Review evidence ↗</a>}<JsonRecord title="Exact reviewed snapshot and reviewer appointment" value={review.reviewed_snapshot} /></li>)}</ol></section>
    <section><h2>Other published attempts for this policy</h2>{related.length ? <ul>{related.map(attempt => <li key={attempt.id}><Link href={`/evaluations/${attempt.id}`}>{attempt.hardware.robot_family} · {attempt.submitter.display_name ?? attempt.submitter.handle ?? "Contributor"} · {statusLabels[displayStatus(attempt)]}</Link></li>)}</ul> : <p>No other published attempts are recorded.</p>}<p>Shows up to 30 recent attempts. These are not automatically independent reproductions; compare protocols and review decisions.</p></section>
    <section><h2>Contribution credits</h2><p>Evaluator: {record.submitter.display_name ?? record.submitter.handle ?? record.submitter.id} · submitted this evaluation, not necessarily the source policy.</p><p>Registry publisher: {record.skill.owner?.name ?? record.skill.owner?.handle ?? "Not recorded"}. Registry ownership does not establish authorship.</p>
      <h3>Declared source authors and contributors</h3>{sourceCredits.length ? <ul>{sourceCredits.map((credit, index) => <li key={index}>{credit.name} · {credit.role} · <a href={credit.source_url}>Original attribution ↗</a></li>)}</ul> : <p>Original policy and dataset author credits are not supplied in this manifest. Consult and cite the source publication; no author is inferred from a repository namespace.</p>}
      <p>Source contributor credits are attributed declarations, not an independent authorship adjudication. Reviewer identities, decisions and evidence are credited in the review history above, including retractions.</p><p>Hardware profile creator: {record.hardware.creator?.display_name ?? record.hardware.creator?.handle ?? "Not recorded"} · this does not appoint an adapter maintainer.</p><a href="/adapters">Inspect actual hardware adapter ownership →</a>
      {!example && <p><a href={`/evaluations/${id}/credits.json`}>Download portable contribution credits (JSON) →</a></p>}
    </section>
    <section><h2>Share, cite or correct this record</h2><p>Permanent evidence URL: <a href={recordUrl(id)}>{recordUrl(id)}</a></p>
      {!example ? <><h3>Evidence-linked README / model-card badge</h3><pre className="evidence-json"><code>{badgeMarkdown(record)}</code></pre><p><a href={`/evaluations/${id}/badge.svg`}>Preview current badge →</a> · <a href={`/evaluations/${id}/citation.json`}>Download citation (CSL JSON) →</a></p><p>The badge describes this record and configuration, not universal compatibility or safety. Image proxies may cache badges: the linked evidence page is authoritative. Update the review-version query after a correction.</p></> : <p>Fictional examples cannot issue badges, citations or contributor-credit credentials.</p>}
      <p><a href={`/evaluations/${id}/record.json`}>Download complete evidence record (JSON) →</a></p>
      <p>Use the <a href={`https://github.com/arcofdescent1/knownrobot/issues/new?template=evidence-correction.yml&title=${encodeURIComponent(`Evidence correction/dispute: ${id}`)}`}>public correction or dispute form</a>. Include this URL and result digest. Read the <a href="/corrections">independent review, remedies and appeal procedure</a>. Published trial evidence is immutable: corrections require a new linked record or an authorized attributable review/retraction, not a silent rewrite.</p>
      <p><a href={`https://github.com/arcofdescent1/knownrobot/issues?q=${encodeURIComponent(`${id} in:title,body`)}`}>Inspect public discussions, corrections and decisions for this record →</a></p>
    </section>
  </main></>;
}
