import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { NewDiscussionForm } from "@/components/community-forms";
import { readArtifact } from "@/lib/artifact-reader";
import { listArtifactThreads } from "@/lib/community-reader";
import { getSessionClient } from "@/lib/supabase/session";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
const one = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] || null : value;
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug; const result = await readArtifact(slug); if (!result) return {};
  return pageMetadata(`/artifacts/${slug}/discussions`, `${result.artifact.title} discussions — Known Robot`, `Public technical discussions, collaboration requests and maintainer clarifications for ${result.artifact.title}.`);
}
export default async function DiscussionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await readArtifact((await params).slug); if (!result) notFound();
  const [threads, session] = await Promise.all([listArtifactThreads(result.artifact.id), getSessionClient()]);
  const user = session ? (await session.auth.getUser()).data.user : null;
  return <><SiteHeader /><main className="editorial-page evidence-page"><p className="eyebrow">Artifact discussions</p><h1>{result.artifact.title}</h1><p>Ask technical questions, request evidence or reproduction, document disagreements, and preserve maintainer clarifications beside the canonical artifact.</p><p><Link href={`/artifacts/${result.artifact.slug}`}>← Canonical artifact record</Link></p><section><h2>Threads and requests</h2><div className="discussion-list">{threads.map(thread => { const author = one(thread.profiles as { handle: string; display_name: string } | Array<{ handle: string; display_name: string }> | null); const count = one(thread.discussion_posts as { count: number } | Array<{ count: number }> | null)?.count || 0; return <article key={thread.id}><p><span className={`status-chip status-${thread.status}`}>{thread.status.replace("_", " ")}</span> <span className="discussion-kind">{thread.kind.replaceAll("_", " ")}</span></p><h3><Link href={`/artifacts/${result.artifact.slug}/discussions/${thread.id}`}>{thread.title}</Link></h3><p>{thread.body.slice(0, 280)}{thread.body.length > 280 ? "…" : ""}</p><p>{count} repl{count === 1 ? "y" : "ies"} · by {author?.handle ? <Link href={`/people/${author.handle}`}>{author.display_name || author.handle}</Link> : "contributor"} · {new Date(thread.updated_at).toLocaleDateString("en-US")}</p></article>; })}</div>{!threads.length ? <p>No discussion yet. Start with a concrete question or evidence request.</p> : null}</section><section><h2>Start a focused discussion</h2>{user ? <NewDiscussionForm artifactId={result.artifact.id} /> : <p><Link href="/account">Sign in and complete a public profile</Link> to contribute.</p>}</section></main></>;
}

