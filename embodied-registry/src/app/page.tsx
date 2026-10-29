import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PublicVocabulary } from "@/components/public-vocabulary";
import { getHomepageSnapshot } from "@/lib/home-reader";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata(
  "/",
  "KnownRobot — Discover reproducible robotics artifacts",
  "Discover revision-pinned robot policies, datasets, software, collections, metadata assessments, and measured reproduction evidence.",
);

function Count({ value }: { value: number | null }) {
  return <strong>{value === null ? "—" : value}</strong>;
}

export default async function Home() {
  const snapshot = await getHomepageSnapshot();
  return <><SiteHeader /><main className="home-page">
    <section className="home-hero">
      <div className="home-hero-copy">
        <p className="kicker">OPEN ROBOT ARTIFACT NETWORK</p>
        <h1>Find the artifact.<br />Inspect the evidence.<br /><em>Improve what is known.</em></h1>
        <p className="home-deck">KnownRobot connects revision-pinned robot policies, datasets, software, hardware context, and published evidence—without turning upstream claims into conclusions.</p>
        <form className="home-search" action="/discover">
          <label><span className="sr-only">Search robot artifacts and evidence</span><input name="q" minLength={2} maxLength={100} placeholder="Search SO-101 ACT, SmolVLA, PushT…" /></label>
          <button type="submit">Search KnownRobot <span aria-hidden="true">→</span></button>
        </form>
        <div className="home-hero-actions"><Link className="primary-link" href="/artifacts">Browse artifacts <span>→</span></Link><Link href="/artifacts/import">Import from GitHub or Hugging Face</Link></div>
      </div>
      <div className="home-proof" role="region" aria-label="Published platform inventory">
        <p className="eyebrow">LIVE PUBLIC INVENTORY</p>
        <div className="home-stat-grid">
          <Link href="/artifacts"><Count value={snapshot.counts.artifacts} /><span>canonical artifacts</span><small>Policies, datasets, and software pinned to source</small></Link>
          <Link href="/collections"><Count value={snapshot.counts.collections} /><span>curated collections</span><small>Focused paths through related robotics work</small></Link>
          <Link href="/assessments"><Count value={snapshot.counts.assessments} /><span>metadata assessments</span><small>Non-executing inspections with explicit gaps</small></Link>
          <Link href="/participate"><Count value={snapshot.counts.attempts} /><span>evidence records</span><small>What contributors observed or measured</small></Link>
        </div>
        <p className="home-proof-note"><span aria-hidden="true">●</span> Counts reflect published public records. Imported metadata is never treated as a measured result or maintainer endorsement.</p>
      </div>
    </section>
    <PublicVocabulary />

    <section className="home-section" aria-labelledby="featured-artifacts">
      <div className="home-section-heading"><div><p className="eyebrow">START WITH A REAL ARTIFACT</p><h2 id="featured-artifacts">Useful artifacts, not an empty directory.</h2><p>Inspect provenance, pinned revisions, assessment gaps, discussion, and available evidence.</p></div><Link href="/artifacts">View all artifacts →</Link></div>
      <div className="home-artifact-grid">{snapshot.artifacts.map((artifact, index) => <article key={artifact.id} className={index === 0 ? "featured" : undefined}>
        <div className="home-card-meta"><span>{artifact.artifact_type}</span><span>{artifact.source_provider}</span></div>
        <h3><Link href={`/artifacts/${artifact.slug}`}>{artifact.title}</Link></h3>
        <p>{artifact.summary || "No upstream summary was available in approved metadata."}</p>
        <footer><code>{artifact.source_repository}</code><Link href={`/artifacts/${artifact.slug}`} aria-label={`Inspect ${artifact.title}`}>Open artifact →</Link></footer>
      </article>)}</div>
      {!snapshot.artifacts.length ? <div className="home-data-unavailable" role="status">Artifact inventory is temporarily unavailable. <Link href="/artifacts">Try the complete artifact index.</Link></div> : null}
    </section>

    <section className="home-section home-collections" aria-labelledby="featured-collections">
      <div className="home-section-heading"><div><p className="eyebrow">CURATED DISCOVERY</p><h2 id="featured-collections">Follow a question, not a filing system.</h2><p>Collections group artifacts around the decisions practitioners actually need to make.</p></div><Link href="/collections">Explore all collections →</Link></div>
      <div className="home-collection-grid">{snapshot.collections.map(collection => <Link key={collection.id} href={`/collections/${collection.slug}`}><span>{collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}</span><h3>{collection.title}</h3><p>{collection.description}</p><strong>Open collection →</strong></Link>)}</div>
    </section>

    <section className="home-loop" aria-labelledby="home-loop-title">
      <div><p className="eyebrow">ONE OPEN EVIDENCE LOOP</p><h2 id="home-loop-title">From upstream artifact to reusable knowledge.</h2><p>KnownRobot keeps source, claims, metadata, execution, and review separate so every contribution makes the next reproduction easier to evaluate.</p></div>
      <ol><li><span>01</span><div><strong>Discover</strong><p>Find an artifact pinned to its upstream revision.</p></div></li><li><span>02</span><div><strong>Assess</strong><p>See what its metadata establishes—and what remains unknown.</p></div></li><li><span>03</span><div><strong>Contribute evidence</strong><p>Publish what you observed or measured.</p></div></li><li><span>04</span><div><strong>Reproduce</strong><p>Independently repeat a result and preserve differences.</p></div></li></ol>
    </section>

    <section className="home-cta"><div><p className="eyebrow">BUILD THE SHARED RECORD</p><h2>Have a robot artifact others should be able to understand?</h2><p>Import approved public metadata, preserve attribution, and expose uncertainty before anyone treats compatibility as fact.</p></div><div><Link className="primary-link lime" href="/artifacts/import">Import an artifact →</Link><Link href="/discussions">Browse evidence discussions</Link></div></section>
  </main></>;
}
