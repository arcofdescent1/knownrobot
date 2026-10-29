import { requireIdentity } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
export async function GET() {
  const { client, user } = await requireIdentity();
  const service = getServiceSupabaseClient();
  if (!service) return Response.json({ error: "Export unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  const [profile, memberships, evaluations, artifacts, artifactContributions, threads, posts, conversations, blocks, reports] = await Promise.all([
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
    service.from("discussion_threads").select("*").eq("author_id", user.id).limit(10000),
    service.from("discussion_posts").select("*").eq("author_id", user.id).limit(10000),
    service.from("message_conversations").select("*").or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`).limit(10000),
    service.from("account_blocks").select("*").eq("blocker_id", user.id).limit(10000),
    service.from("message_reports").select("*").eq("reporter_id", user.id).limit(10000),
  ]);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, follow",
    "Content-Disposition": "attachment; filename=knownrobot-identity.json",
  };
  if ([profile, memberships, evaluations, artifacts, artifactContributions, threads, posts, conversations, blocks, reports].some((result) => result.error))
    return Response.json(
      { error: "Export unavailable" },
      { status: 503, headers },
    );
  const conversationIds = (conversations.data || []).map(item => item.id);
  const messages = conversationIds.length ? await service.from("direct_messages").select("*").in("conversation_id", conversationIds).limit(10000) : { data: [], error: null };
  if (messages.error) return Response.json({ error: "Export unavailable" }, { status: 503, headers });
  return Response.json(
    {
      schema_version: 1,
      knownrobot_id: user.id,
      profile: profile.data,
      memberships: memberships.data,
      evaluations: evaluations.data,
      artifacts: artifacts.data,
      artifact_contributions: artifactContributions.data,
      discussion_threads: threads.data,
      discussion_posts: posts.data,
      message_conversations: conversations.data,
      direct_messages: messages.data,
      account_blocks: blocks.data,
      message_reports: reports.data,
      limit: 10000,
      credentials_included: false,
    },
    { headers },
  );
}
