import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getPublicSupabaseClient } from "@/lib/supabase/server";
import { safeEvidenceUrl } from "@/lib/evidence-contract";
import { pageMetadata } from "@/lib/seo";
import { oneRelation } from "@/lib/identity-reader";
export const dynamic = "force-dynamic";
const readProfile = cache(async (handle: string) => {
  if (!/^[a-z0-9][a-z0-9-]{2,38}$/.test(handle)) notFound();
  const client = getPublicSupabaseClient();
  if (!client) throw new Error("Profiles are unavailable.");
  const { data: profile, error } = await client
    .from("profiles")
    .select(
      "id,handle,display_name,bio,affiliation,github_url,huggingface_url,created_at",
    )
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new Error("Profiles are temporarily unavailable.");
  if (!profile) notFound();
  const [evaluations, reviews, teams] = await Promise.all([
    client
      .from("public_registry_records")
      .select("id,record")
      .eq("submitted_by", profile.id)
      .order("published_at", { ascending: false })
      .limit(50),
    client
      .from("verification_reviews")
      .select("id,evaluation_id,new_status,created_at")
      .eq("reviewer_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("organization_members")
      .select("role,organizations(slug,name)")
      .eq("profile_id", profile.id),
  ]);
  if ([evaluations, reviews, teams].some((result) => result.error))
    throw new Error("Contribution records are temporarily unavailable.");
  return {
    profile,
    evaluations: evaluations.data || [],
    reviews: reviews.data || [],
    teams: (teams.data || []).map(team=>({...team,organizations:oneRelation(team.organizations)})),
  };
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const handle = (await params).handle;
  const result = await readProfile(handle);
  return pageMetadata(
    `/people/${handle}`,
    `${result.profile.display_name || handle} — Known Robot contributor`,
    "Attributable public evaluations, review decisions and team memberships.",
    { index: result.evaluations.length + result.reviews.length > 0 },
  );
}
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { profile, evaluations, reviews, teams } = await readProfile(
    (await params).handle,
  );
  return (
    <>
      <SiteHeader />
      <main className="editorial-page identity-page">
        <h1>{profile.display_name || profile.handle}</h1>
        <p>
          @{profile.handle} · Known Robot ID: <code>{profile.id}</code>
        </p>
        <p>{profile.bio}</p>
        {profile.affiliation ? (
          <p>Affiliation (self-declared): {profile.affiliation}</p>
        ) : null}
        <p>
          External links are self-declared, not proof of account ownership or
          institutional affiliation. A profile does not confer verification
          authority.
        </p>
        {[profile.github_url, profile.huggingface_url]
          .filter((value) => safeEvidenceUrl(value))
          .map((value) => (
            <p key={value}>
              <a
                href={safeEvidenceUrl(value)!}
                rel="nofollow noopener noreferrer"
              >
                {value}
              </a>
            </p>
          ))}
        <h2>Teams</h2>
        {teams.map((team, index) => (
          <p key={index}>
            <Link href={`/teams/${team.organizations?.slug}`}>
              {team.organizations?.name}
            </Link>{" "}
            — {team.role}
          </p>
        ))}
        {!teams.length ? <p>No team memberships.</p> : null}
        <h2>Published evaluations</h2>
        {evaluations.map((item) => (
          <p key={item.id}>
            <Link href={`/evaluations/${item.id}`}>
              {item.record?.skill?.name || item.id}
            </Link>
          </p>
        ))}
        {!evaluations.length ? <p>No published evaluations yet.</p> : null}
        <h2>Attributed review decisions</h2>
        {reviews.map((review) => (
          <p key={review.id}>
            <Link href={`/evaluations/${review.evaluation_id}`}>
              {review.new_status} decision — {review.created_at}
            </Link>
          </p>
        ))}
        {!reviews.length ? (
          <p>
            No public review decisions. This does not imply appointment as a
            reviewer.
          </p>
        ) : null}
        <p>
          Shows up to 50 recent evaluations and 50 public decisions. Credits
          describe recorded contributions, not an expertise score.
        </p>
      </main>
    </>
  );
}
