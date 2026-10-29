import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DiscussionReplyForm, DiscussionStatusForm, MessageRequestForm } from "@/components/community-forms";
import { readDiscussionThread } from "@/lib/community-reader";
import { getSessionClient } from "@/lib/supabase/session";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
const one = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] || null : value;
export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const result = await readDiscussionThread(id); if (!result) return {};
  return pageMetadata(`/artifacts/${slug}/discussions/${id}`, `${result.thread.title} — Known Robot discussion`, result.thread.body.slice(0, 155));
}
export default async function ThreadPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params; const result = await readDiscussionThread(id); if (!result) notFound();
  const artifact = one(result.thread.artifacts as { id: string; slug: string; title: string } | null); if (!artifact || artifact.slug !== slug) notFound();
  const author = one(result.thread.profiles as { handle: string; display_name: string } | Array<{ handle: string; display_name: string }> | null);
  const publisher = one(result.thread.publisher as { handle: string; display_name: string } | Array<{ handle: string; display_name: string }> | null);
  const session = await getSessionClient(); const user = session ? (await session.auth.getUser()).data.user : null;
  return <><SiteHeader /><main className="editorial-page evidence-page">
    <p className="eyebrow">{result.thread.kind.replaceAll("_", " ")} · {result.thread.status.replace("_", " ")}</p>
    <h1>{result.thread.title}</h1><p><Link href={`/artifacts/${slug}?tab=discussions`}>← All {artifact.title} discussions</Link></p>
    <article className="discussion-root"><p>{result.thread.body}</p>{result.thread.desired_outcome ? <aside className="boundary-note"><strong>Desired outcome:</strong> {result.thread.desired_outcome}</aside> : null}<p>Started by {author?.handle ? <Link href={`/people/${author.handle}`}>{author.display_name || author.handle}</Link> : publisher?.display_name || publisher?.handle || "contributor"} on {new Date(result.thread.created_at).toLocaleString("en-US")}</p></article>
    <section><h2>Public contributions</h2><ol className="discussion-posts">{result.posts.map(post => {
      const person = one(post.profiles as { handle: string; display_name: string } | Array<{ handle: string; display_name: string }> | null);
      return <li key={post.id} id={`post-${post.id}`} className={post.parent_id ? "nested-reply" : undefined}>
        {post.parent_id ? <p className="reply-context">Replying to <a href={`#post-${post.parent_id}`}>an earlier contribution</a></p> : null}
        <p>{post.body}</p><p>— {person?.handle ? <Link href={`/people/${person.handle}`}>{person.display_name || person.handle}</Link> : "contributor"}, {new Date(post.created_at).toLocaleString("en-US")}</p>
        {user && result.thread.status !== "closed" ? <details><summary>Reply to this contribution</summary><DiscussionReplyForm threadId={id} parentId={post.id} /></details> : null}
      </li>;
    })}</ol>{!result.posts.length ? <p>No replies yet.</p> : null}{user && result.thread.status !== "closed" ? <DiscussionReplyForm threadId={id} /> : user ? <p>This discussion is closed.</p> : <p><Link href="/account">Sign in</Link> to reply.</p>}</section>
    {user ? <section><h2>Request status</h2><p>The requester or a verified artifact maintainer can update this lifecycle. History remains public.</p><DiscussionStatusForm threadId={id} current={result.thread.status} />{author?.handle && result.thread.author_id !== user.id ? <><h3>Coordinate privately</h3><p>Private coordination requires this contributor to accept. Conclusions and evidence should return to the public thread.</p><MessageRequestForm artifactId={result.thread.artifact_id} recipientHandle={author.handle} /></> : null}</section> : null}
    <section><h2>Status history</h2>{result.history.map(item => { const person = one(item.profiles as { handle: string; display_name: string } | Array<{ handle: string; display_name: string }> | null); return <p key={item.id}><strong>{item.from_status || "created"} → {item.to_status}</strong> by {person?.display_name || person?.handle || "contributor"}{item.note ? ` — ${item.note}` : ""}</p>; })}{!result.history.length ? <p>No status changes.</p> : null}</section>
  </main></>;
}

