import { requireIdentity } from "@/lib/supabase/session";
export async function GET() {
  const { client, user } = await requireIdentity();
  const [profile, memberships, evaluations] = await Promise.all([
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
  ]);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, follow",
    "Content-Disposition": "attachment; filename=knownrobot-identity.json",
  };
  if ([profile, memberships, evaluations].some((result) => result.error))
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
      limit: 10000,
      credentials_included: false,
    },
    { headers },
  );
}
