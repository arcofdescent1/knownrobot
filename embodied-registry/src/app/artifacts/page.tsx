import Link from "next/link";
import { ActionEmptyState } from "@/components/action-empty-state";
import { SiteHeader } from "@/components/site-header";
import { PublicVocabulary } from "@/components/public-vocabulary";
import { listArtifacts } from "@/lib/artifact-reader";
import { pageMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata("/artifacts", "Robot policies, datasets and hardware — Known Robot", "Canonical, revision-pinned robotics artifacts with attribution, metadata boundaries and public contribution history.");
export default async function ArtifactsPage() {
  const artifacts = await listArtifacts();
  return <><SiteHeader /><main className="editorial-page evidence-page"><p className="eyebrow">Canonical discovery</p><h1>Robot artifacts, pinned to their source</h1><p>An artifact is the policy, dataset, hardware, or software itself. KnownRobot preserves its upstream URL, immutable revision, inspected metadata, and uncertainty without copying it or implying compatibility.</p><PublicVocabulary compact/><p><Link className="primary-link" href="/artifacts/import">Import an artifact →</Link></p><div className="artifact-list">{artifacts.map(item => <article key={item.id}><p className="eyebrow">{item.artifact_type} · {item.source_provider}</p><h2><Link href={`/artifacts/${item.slug}`}>{item.title}</Link></h2><p>{item.summary || "No upstream summary was available in approved metadata."}</p><p><code>{item.source_repository}</code></p><p><Link href={`/artifacts/${item.slug}?tab=evidence`}>Open artifact and evidence →</Link></p></article>)}</div>{!artifacts.length ? <ActionEmptyState title="Bring the first artifact into view" description="Import a public GitHub or Hugging Face URL to create an attributable, revision-pinned page others can inspect and improve." actionHref="/artifacts/import" actionLabel="Import an artifact"/> : null}</main></>;
}
