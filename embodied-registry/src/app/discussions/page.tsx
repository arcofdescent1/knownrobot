import Link from "next/link";
import { ActionEmptyState } from "@/components/action-empty-state";
import { SiteHeader } from "@/components/site-header";
import { listDiscussionFeed } from "@/lib/community-reader";
import { getSessionClient } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/discussions", "Robotics artifact discussions — Known Robot", "Compatibility questions, evidence requests, reproductions, corrections, and maintainer updates attached to canonical robotics artifacts.");
const kinds = ["compatibility_question", "metadata_correction", "reproduction_request", "evidence_request", "disputed_finding", "maintainer_announcement", "discussion"];
const one = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value;
const compatibilityThread = "/artifacts/huggingface-aadarshram-act-pusht/discussions/a1000000-0000-4000-8000-000000000001";
const reproductionThread = "/artifacts/huggingface-abdul004-so101-act-policy-v5/discussions/a1000000-0000-4000-8000-000000000002";

function DiscussionActions() {
  return <nav className="discussion-actions" aria-label="Start contributing"><Link href="/discover?evidence=needs-evidence"><span>01</span><strong>Browse artifacts needing evidence</strong><small>Find records with explicit, actionable gaps.</small></Link><Link href={compatibilityThread}><span>02</span><strong>Ask a compatibility question</strong><small>Help define what must be known before transfer.</small></Link><Link href={reproductionThread}><span>03</span><strong>Request a reproduction</strong><small>Turn an upstream claim into a measured attempt.</small></Link></nav>;
}

export default async function DiscussionsPage({ searchParams }: { searchParams: Promise<{ kind?: string; view?: string }> }) {
  const params = await searchParams;
  const kind = kinds.includes(params.kind || "") ? params.kind : undefined;
  let artifactIds: string[] | undefined;
  let signedIn = false;
  if (params.view === "following") {
    const client = await getSessionClient();
    const user = client ? (await client.auth.getUser()).data.user : null;
    signedIn = Boolean(user);
    if (user) {
      const service = getServiceSupabaseClient();
      const follows = service ? await service.from("follows").select("artifact_id").eq("follower_id", user.id).not("artifact_id", "is", null) : null;
      artifactIds = (follows?.data || []).map(item => item.artifact_id).filter((id): id is string => Boolean(id));
    }
  }
  const threads = await listDiscussionFeed({ kind, artifactIds });
  return <><SiteHeader /><main className="editorial-page evidence-page discussions-page"><header className="discussion-hero"><p className="eyebrow">Community evidence work</p><h1>Move the shared record forward.</h1><p>Ask precise compatibility questions, request measured reproductions, correct metadata, and preserve disagreements beside the artifact they concern.</p></header><DiscussionActions /><nav className="filter-tabs" aria-label="Discussion filters"><Link href="/discussions">All</Link><Link href="/discussions?view=following">Following</Link>{kinds.slice(0, 6).map(value => <Link key={value} href={`/discussions?kind=${value}`}>{value.replaceAll("_", " ")}</Link>)}</nav>{params.view === "following" && !signedIn ? <aside className="setup-callout"><p><Link href="/login">Log in</Link> to view discussions on artifacts you follow.</p></aside> : null}<div className="discussion-feed">{threads.map(thread => { const artifact = one(thread.artifacts); const author = one(thread.profiles); const publisher = one(thread.publisher); const replies = one(thread.discussion_posts)?.count || 0; return <article key={thread.id}><div><span className={`status-chip status-${thread.status}`}>{thread.status.replaceAll("_", " ")}</span><span className="discussion-kind">{thread.kind.replaceAll("_", " ")}</span></div><h2><Link href={`/artifacts/${artifact?.slug}/discussions/${thread.id}`}>{thread.title}</Link></h2><p>{thread.body.slice(0, 300)}{thread.body.length > 300 ? "…" : ""}</p><footer><Link href={`/artifacts/${artifact?.slug}`}>{artifact?.title}</Link><span>{replies} {replies === 1 ? "reply" : "replies"}</span><span>{author?.display_name || author?.handle || publisher?.display_name || publisher?.handle || "Contributor"}</span><span>{new Date(thread.updated_at).toLocaleDateString("en-US")}</span></footer></article>; })}</div>{!threads.length ? <ActionEmptyState title="Turn a known gap into useful work" description="Browse artifacts that still need evidence, then ask one precise question or request an independent reproduction from its discussion tab." actionHref="/discover?evidence=needs-evidence" actionLabel="Browse evidence gaps"/> : null}</main></>;
}
