import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { AccountNav } from "@/components/account-nav";
import { requireIdentity } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata("/dashboard", "Dashboard — Known Robot", "Your KnownRobot contributor dashboard.", { index: false });
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { user, client } = await requireIdentity(); const service = getServiceSupabaseClient(); if (!service) throw new Error("Account service unavailable.");
  await client.rpc("record_account_workspace_activity");
  const [profile, artifacts, contributions, collections, notifications, pending, unread] = await Promise.all([
    service.from("profiles").select("handle,display_name").eq("id", user.id).maybeSingle(),
    service.from("artifacts").select("id,slug,title,artifact_type,updated_at").or(`owner_profile_id.eq.${user.id},imported_by.eq.${user.id}`).order("updated_at", { ascending: false }).limit(5),
    service.from("artifact_contributions").select("id,kind,summary,created_at,artifacts(slug,title)").eq("contributor_profile_id", user.id).order("created_at", { ascending: false }).limit(5),
    service.from("collections").select("id,slug,title,updated_at").or(`owner_profile_id.eq.${user.id},created_by.eq.${user.id}`).order("updated_at", { ascending: false }).limit(5),
    service.from("notifications").select("id,title,body,href,created_at").eq("recipient_id", user.id).is("read_at", null).order("created_at", { ascending: false }).limit(5),
    service.from("message_conversations").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).eq("status", "pending"),
    service.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null),
  ]);
  const attention = (notifications.data?.length || 0) + (pending.count || 0) + (unread.count || 0);
  return <><SiteHeader/><main className="app-page"><AccountNav/><header className="app-heading"><div><p className="eyebrow">Contributor dashboard</p><h1>Welcome back{profile.data?.display_name ? `, ${profile.data.display_name}` : ""}.</h1><p>Continue useful work across the robotics artifacts and evidence you care about.</p></div><Link className="primary-link" href="/artifacts/import">Import an artifact</Link></header>
    {!profile.data?.handle ? <aside className="setup-callout"><strong>Complete your public contributor profile.</strong><p>A handle is required to discuss artifacts, message collaborators, and receive contribution credit.</p><Link href="/settings/profile">Complete profile →</Link></aside> : null}
    <section className="metric-grid"><Link href="/messages"><strong>{unread.count || 0}</strong><span>Unread messages</span></Link><Link href="/messages"><strong>{pending.count || 0}</strong><span>Pending requests</span></Link><Link href="/notifications"><strong>{notifications.data?.length || 0}</strong><span>Unread updates</span></Link><div><strong>{attention}</strong><span>Items needing attention</span></div></section>
    <div className="dashboard-grid"><section><div className="section-heading"><h2>Needs your attention</h2><Link href="/notifications">View all</Link></div>{notifications.data?.map(item=><article className="compact-card" key={item.id}><h3><Link href={item.href}>{item.title}</Link></h3><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("en-US")}</small></article>)}{!notifications.data?.length ? <p>You are caught up.</p> : null}</section>
    <section><div className="section-heading"><h2>Your artifacts</h2><Link href="/artifacts">Browse</Link></div>{artifacts.data?.map(item=><article className="compact-card" key={item.id}><h3><Link href={`/artifacts/${item.slug}`}>{item.title}</Link></h3><p>{item.artifact_type}</p></article>)}{!artifacts.data?.length ? <p>No imported or claimed artifacts yet.</p> : null}</section>
    <section><div className="section-heading"><h2>Recent contributions</h2><Link href="/discussions">Join a discussion</Link></div>{contributions.data?.map(item=>{const artifact=Array.isArray(item.artifacts)?item.artifacts[0]:item.artifacts;return <article className="compact-card" key={item.id}><h3>{item.kind.replaceAll("_"," ")}</h3><p>{artifact?.slug?<Link href={`/artifacts/${artifact.slug}`}>{artifact.title}</Link>:"Artifact"} — {item.summary}</p></article>})}{!contributions.data?.length ? <p>Your public contributions will appear here.</p> : null}</section>
    <section><div className="section-heading"><h2>Your collections</h2><Link href="/collections/new">Create</Link></div>{collections.data?.map(item=><article className="compact-card" key={item.id}><h3><Link href={`/collections/${item.slug}`}>{item.title}</Link></h3></article>)}{!collections.data?.length ? <p>No collections yet.</p> : null}</section></div></main></>;
}
