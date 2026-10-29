import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPublicSupabaseClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { oneRelation } from "@/lib/identity-reader";
import { ResourceFollow } from "@/components/resource-follow";
import { ActionEmptyState } from "@/components/action-empty-state";
export const dynamic = "force-dynamic";
const readTeam = cache(async (slug: string) => {
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(slug)) notFound();
  const client = getPublicSupabaseClient();
  if (!client) throw new Error("Teams unavailable.");
  const { data: team, error } = await client
    .from("organizations")
    .select("id,slug,name,description")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Team data unavailable.");
  if (!team) notFound();
  const [members, skills, artifacts, collections] = await Promise.all([
    client
      .from("organization_members")
      .select("role,profiles(handle,display_name)")
      .eq("organization_id", team.id),
    client
      .from("skills")
      .select("id")
      .eq("owner_organization_id", team.id)
      .not("published_at", "is", null),
    client.from("artifacts").select("id,slug,title,artifact_type").eq("owner_organization_id", team.id).order("updated_at", { ascending: false }).limit(50),
    client.from("collections").select("id,slug,title,description").eq("owner_organization_id", team.id).order("updated_at", { ascending: false }).limit(50),
  ]);
  if (members.error || skills.error || artifacts.error || collections.error)
    throw new Error("Team contributions unavailable.");
  const evidence = skills.data?.length
    ? await client
        .from("public_registry_records")
        .select("id,record")
        .in(
          "skill_id",
          skills.data.map((skill) => skill.id),
        )
        .order("published_at", { ascending: false })
        .limit(50)
    : { data: [], error: null };
  if (evidence.error) throw new Error("Team evidence unavailable.");
  return {
    team,
    members: (members.data || []).map(member=>({...member,profiles:oneRelation(member.profiles)})),
    evaluations: evidence.data || [],
    artifacts: artifacts.data || [],
    collections: collections.data || [],
  };
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const result = await readTeam(slug);
  return pageMetadata(
    `/teams/${slug}`,
    `${result.team.name} — Known Robot team`,
    "Public team membership and attributable robot evaluation evidence.",
    { index: result.evaluations.length + result.artifacts.length > 0 },
  );
}
export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { team, members, evaluations, artifacts, collections } = await readTeam((await params).slug);
  return (
    <>
      <SiteHeader />
      <main className="editorial-page identity-page">
        <h1>{team.name}</h1>
        <p>
          Known Robot team ID: <code>{team.id}</code>
        </p>
        <p>{team.description}</p>
        <ResourceFollow type="organization" id={team.id} />
        <p>
          This is a contributor-managed team, not a verified institution. Team
          roles manage membership and do not grant evaluation verification
          authority.
        </p>
        <h2>Members</h2>
        {members.map((member, index) => (
          <p key={index}>
            {member.profiles?.handle ? (
              <Link href={`/people/${member.profiles.handle}`}>
                {member.profiles.display_name || member.profiles.handle}
              </Link>
            ) : (
              "Contributor"
            )}{" "}
            — {member.role}
          </p>
        ))}
        <h2>Published team evaluations</h2>
        {evaluations.map((item) => (
          <p key={item.id}>
            <Link href={`/evaluations/${item.id}`}>
              {item.record?.skill?.name || item.id}
            </Link>
          </p>
        ))}
        {!evaluations.length ? <ActionEmptyState compact title="Give the team a reproducible evidence trail" description="Published evidence connects observed outcomes to the exact artifact, hardware, and protocol." actionHref="/artifacts" actionLabel="Choose an artifact"/> : null}
        <h2>Repository-verified artifacts</h2>
        {artifacts.map(item => <p key={item.id}><Link href={`/artifacts/${item.slug}`}>{item.title}</Link> — {item.artifact_type}</p>)}
        {!artifacts.length ? <ActionEmptyState compact title="Connect upstream work to this team" description="A repository-backed claim makes maintenance responsibility visible while preserving the original host and attribution." actionHref="/artifacts" actionLabel="Browse artifacts"/> : null}
        <h2>Collections</h2>
        {collections.map(item => <p key={item.id}><Link href={`/collections/${item.slug}`}>{item.title}</Link> — {item.description}</p>)}
        {!collections.length ? <ActionEmptyState compact title="Publish a shared research path" description="A team collection groups the artifacts and evidence contributors need for one concrete robotics question." actionHref="/collections" actionLabel="Explore collections"/> : null}
        <p>
          Shows up to 50 recent public evaluations. Membership changes do not
          rewrite historical evaluation or review attribution.
        </p>
      </main>
    </>
  );
}
