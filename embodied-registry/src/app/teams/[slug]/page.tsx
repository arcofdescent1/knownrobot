import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPublicSupabaseClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { oneRelation } from "@/lib/identity-reader";
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
  const [members, skills] = await Promise.all([
    client
      .from("organization_members")
      .select("role,profiles(handle,display_name)")
      .eq("organization_id", team.id),
    client
      .from("skills")
      .select("id")
      .eq("owner_organization_id", team.id)
      .not("published_at", "is", null),
  ]);
  if (members.error || skills.error)
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
    { index: result.evaluations.length > 0 },
  );
}
export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { team, members, evaluations } = await readTeam((await params).slug);
  return (
    <>
      <SiteHeader />
      <main className="editorial-page identity-page">
        <h1>{team.name}</h1>
        <p>
          Known Robot team ID: <code>{team.id}</code>
        </p>
        <p>{team.description}</p>
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
        {!evaluations.length ? <p>No published team evaluations yet.</p> : null}
        <p>
          Shows up to 50 recent public evaluations. Membership changes do not
          rewrite historical evaluation or review attribution.
        </p>
      </main>
    </>
  );
}
