import { requireIdentity } from "@/lib/supabase/session";
export async function GET() {
  const { client, user } = await requireIdentity();
  const [profile, memberships, evaluations, artifacts, artifactContributions] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client
      .from("organization_members")
      .select("organization_id,role")
      .eq("profile_id", user.id),
    client
      .from("evaluations")
      .select("*")
      .eq("submitted_by", user.id)
      .order("created_at")
      .limit(10000),
    client.from("artifacts").select("*").or(`owner_profile_id.eq.${user.id},imported_by.eq.${user.id}`).limit(10000),
    client.from("artifact_contributions").select("*").eq("contributor_profile_id", user.id).limit(10000),
  ]);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, follow",
    "Content-Disposition": "attachment; filename=knownrobot-identity.json",
  };
  if ([profile, memberships, evaluations, artifacts, artifactContributions].some((result) => result.error))
    return Response.json(
      { error: "Export unavailable" },
      { status: 503, headers },
    );
  return Response.json(
    {
      schema_version: 1,
      knownrobot_id: user.id,
      profile: profile.data,
      memberships: memberships.data,
      evaluations: evaluations.data,
      artifacts: artifacts.data,
      artifact_contributions: artifactContributions.data,
      limit: 10000,
      credentials_included: false,
    },
    { headers },
  );
}
