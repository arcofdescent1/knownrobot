"use server";
import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import {
  conversationResponseSchema, conversationSchema, directMessageSchema, discussionPostSchema,
  discussionStatusSchema, discussionThreadSchema, messageRequestSchema, reportSchema,
  type CommunityState,
} from "@/lib/community-contract";
import { notifyFollowers } from "@/lib/platform-service";

const fail = (message: string): CommunityState => ({ ok: false, message });
async function context() {
  const session = await requireIdentity();
  const profile = await session.client.from("profiles").select("id,handle").eq("id", session.user.id).maybeSingle();
  if (!profile.data?.handle) throw new Error("Complete your public profile first.");
  const service = getServiceSupabaseClient();
  if (!service) throw new Error("Community service is unavailable.");
  return { user: session.user, service };
}
async function activity(service: NonNullable<ReturnType<typeof getServiceSupabaseClient>>, account: string, event: string, resource: string, dedupe: string) {
  await service.rpc("record_community_activity", { p_account: account, p_event: event, p_resource: resource, p_dedupe: dedupe });
}
async function notify(service: NonNullable<ReturnType<typeof getServiceSupabaseClient>>, recipients: string[], eventType: string, title: string, body: string, href: string, actor: string, resource: string) {
  const rows = [...new Set(recipients)].filter(id => id !== actor).map(recipient_id => ({ recipient_id, event_type: eventType, title, body, href, actor_id: actor, resource_key: resource }));
  if (rows.length) await service.from("notifications").upsert(rows, { onConflict: "recipient_id,event_type,resource_key", ignoreDuplicates: true });
}
const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] || null : value || null;

export async function createDiscussion(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = discussionThreadSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const artifact = await service.from("artifacts").select("id,slug,title").eq("id", parsed.data.artifact_id).maybeSingle();
    if (!artifact.data) return fail("Artifact not found.");
    if (parsed.data.kind === "maintainer_announcement" && !await canManageThread(service, user.id, { author_id: "", artifact_id: artifact.data.id })) return fail("Only a verified artifact maintainer can publish a maintainer announcement.");
    const created = await service.from("discussion_threads").insert({ ...parsed.data, author_id: user.id }).select("id").single();
    if (created.error) throw created.error;
    await service.from("discussion_history").insert({ thread_id: created.data.id, actor_id: user.id, from_status: null, to_status: "open", note: "Discussion created." });
    const isRequest = ["reproduction_request", "evidence_request"].includes(parsed.data.kind);
    await activity(service, user.id, isRequest ? "collaboration_request_started" : "discussion_started", parsed.data.artifact_id, created.data.id);
    await notifyFollowers(service, { artifact_id: parsed.data.artifact_id }, isRequest ? "collaboration_request" : "discussion_reply", `${artifact.data.title}: ${parsed.data.title}`, isRequest ? parsed.data.desired_outcome : "A contributor started a public artifact discussion.", `/artifacts/${artifact.data.slug}/discussions/${created.data.id}`, user.id, created.data.id);
    revalidatePath(`/artifacts/${artifact.data.slug}`);
    revalidatePath(`/artifacts/${artifact.data.slug}/discussions`);
    return { ok: true, message: isRequest ? "Collaboration request published." : "Discussion published.", href: `/artifacts/${artifact.data.slug}/discussions/${created.data.id}` };
  } catch (error) { return fail(error instanceof Error ? error.message : "Discussion could not be created."); }
}

export async function replyToDiscussion(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = discussionPostSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const thread = await service.from("discussion_threads").select("id,title,status,author_id,artifact_id,artifacts(slug,title)").eq("id", parsed.data.thread_id).maybeSingle();
    if (!thread.data || thread.data.status === "closed") return fail("This discussion is closed.");
    const post = await service.from("discussion_posts").insert({ thread_id: parsed.data.thread_id, parent_id: parsed.data.parent_id || null, body: parsed.data.body, author_id: user.id }).select("id").single();
    if (post.error) throw post.error;
    await service.from("discussion_threads").update({ updated_at: new Date().toISOString() }).eq("id", parsed.data.thread_id);
    const participants = await service.from("discussion_posts").select("author_id").eq("thread_id", parsed.data.thread_id);
    const artifact = relation(thread.data.artifacts);
    await activity(service, user.id, "discussion_replied", thread.data.artifact_id, post.data.id);
    await notify(service, [thread.data.author_id, ...(participants.data || []).map(row => row.author_id)], "discussion_reply", `Reply: ${thread.data.title}`, "A contributor replied to an artifact discussion.", `/artifacts/${artifact?.slug}/discussions/${thread.data.id}`, user.id, post.data.id);
    revalidatePath(`/artifacts/${artifact?.slug}/discussions/${thread.data.id}`);
    return { ok: true, message: "Reply published." };
  } catch (error) { return fail(error instanceof Error ? error.message : "Reply could not be published."); }
}

async function canManageThread(service: NonNullable<ReturnType<typeof getServiceSupabaseClient>>, user: string, thread: { author_id: string; artifact_id: string }) {
  if (thread.author_id === user) return true;
  const [artifact, claim] = await Promise.all([
    service.from("artifacts").select("owner_profile_id,imported_by").eq("id", thread.artifact_id).single(),
    service.from("artifact_claims").select("claimant_profile_id").eq("artifact_id", thread.artifact_id).maybeSingle(),
  ]);
  return artifact.data?.owner_profile_id === user || artifact.data?.imported_by === user || claim.data?.claimant_profile_id === user;
}

export async function updateDiscussionStatus(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = discussionStatusSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const thread = await service.from("discussion_threads").select("id,author_id,artifact_id,kind,status,title,artifacts(slug)").eq("id", parsed.data.thread_id).maybeSingle();
    if (!thread.data || !await canManageThread(service, user.id, thread.data)) return fail("Only the requester or a verified artifact maintainer can change this status.");
    if (thread.data.status === parsed.data.status) return fail("The discussion already has that status.");
    const updated = await service.from("discussion_threads").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", thread.data.id);
    if (updated.error) throw updated.error;
    await service.from("discussion_history").insert({ thread_id: thread.data.id, actor_id: user.id, from_status: thread.data.status, to_status: parsed.data.status, note: parsed.data.note });
    const participants = await service.from("discussion_posts").select("author_id").eq("thread_id", thread.data.id);
    const artifact = relation(thread.data.artifacts);
    await notify(service, [thread.data.author_id, ...(participants.data || []).map(row => row.author_id)], "collaboration_status", `${thread.data.title}: ${parsed.data.status.replace("_", " ")}`, parsed.data.note || "The artifact discussion status changed.", `/artifacts/${artifact?.slug}/discussions/${thread.data.id}`, user.id, `${thread.data.id}:${parsed.data.status}`);
    if (["reproduction_request", "evidence_request"].includes(thread.data.kind) && parsed.data.status === "resolved") await activity(service, user.id, "collaboration_request_completed", thread.data.artifact_id, thread.data.id);
    revalidatePath(`/artifacts/${artifact?.slug}/discussions/${thread.data.id}`);
    return { ok: true, message: `Status changed to ${parsed.data.status.replace("_", " ")}.` };
  } catch (error) { return fail(error instanceof Error ? error.message : "Status could not be changed."); }
}

async function hasArtifactContext(service: NonNullable<ReturnType<typeof getServiceSupabaseClient>>, user: string, artifact: string) {
  const [owned, contribution, claim, thread, post] = await Promise.all([
    service.from("artifacts").select("id").eq("id", artifact).or(`owner_profile_id.eq.${user},imported_by.eq.${user}`).maybeSingle(),
    service.from("artifact_contributions").select("id").eq("artifact_id", artifact).eq("contributor_profile_id", user).limit(1).maybeSingle(),
    service.from("artifact_claims").select("id").eq("artifact_id", artifact).eq("claimant_profile_id", user).maybeSingle(),
    service.from("discussion_threads").select("id").eq("artifact_id", artifact).eq("author_id", user).limit(1).maybeSingle(),
    service.from("discussion_posts").select("id,discussion_threads!inner(artifact_id)").eq("author_id", user).eq("discussion_threads.artifact_id", artifact).limit(1).maybeSingle(),
  ]);
  return Boolean(owned.data || contribution.data || claim.data || thread.data || post.data);
}

export async function requestConversation(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = messageRequestSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const [recipient, artifact] = await Promise.all([
      service.from("profiles").select("id,handle,display_name").eq("handle", parsed.data.recipient_handle).maybeSingle(),
      service.from("artifacts").select("id,slug,title").eq("id", parsed.data.artifact_id).maybeSingle(),
    ]);
    if (!recipient.data || !artifact.data) return fail("Recipient or shared artifact not found.");
    if (recipient.data.id === user.id) return fail("Choose another contributor.");
    const [blocked, senderContext, recipientContext, recent] = await Promise.all([
      service.from("account_blocks").select("blocker_id").or(`and(blocker_id.eq.${user.id},blocked_id.eq.${recipient.data.id}),and(blocker_id.eq.${recipient.data.id},blocked_id.eq.${user.id})`).limit(1),
      hasArtifactContext(service, user.id, artifact.data.id),
      hasArtifactContext(service, recipient.data.id, artifact.data.id),
      service.from("message_conversations").select("id", { count: "exact", head: true }).eq("requester_id", user.id).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    ]);
    if (blocked.data?.length) return fail("This conversation is unavailable.");
    if (!senderContext || !recipientContext) return fail("Both accounts must have public activity on the selected artifact before messaging.");
    if ((recent.count || 0) >= 3) return fail("Daily message-request limit reached. Try again tomorrow.");
    const conversation = await service.from("message_conversations").insert({ requester_id: user.id, recipient_id: recipient.data.id, artifact_id: artifact.data.id }).select("id").single();
    if (conversation.error) return fail(conversation.error.code === "23505" ? "A request for this contributor and artifact is already pending." : "Message request could not be created.");
    const first = await service.from("direct_messages").insert({ conversation_id: conversation.data.id, sender_id: user.id, body: parsed.data.note }).select("id").single();
    if (first.error) throw first.error;
    await activity(service, user.id, "message_request_sent", artifact.data.id, conversation.data.id);
    await notify(service, [recipient.data.id], "message_request", `Message request about ${artifact.data.title}`, "A contributor with shared public artifact activity requested a private conversation.", "/messages", user.id, conversation.data.id);
    revalidatePath("/messages");
    return { ok: true, message: "Message request sent. The recipient must accept before you can continue.", href: "/messages" };
  } catch (error) { return fail(error instanceof Error ? error.message : "Message request failed."); }
}

export async function respondToConversation(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = conversationResponseSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail("Invalid response.");
    const conversation = await service.from("message_conversations").select("id,requester_id,recipient_id,status").eq("id", parsed.data.conversation_id).maybeSingle();
    if (!conversation.data || conversation.data.recipient_id !== user.id || conversation.data.status !== "pending") return fail("This request cannot be changed.");
    const update = await service.from("message_conversations").update({ status: parsed.data.response, accepted_at: parsed.data.response === "accepted" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", conversation.data.id).eq("status", "pending");
    if (update.error) throw update.error;
    await notify(service, [conversation.data.requester_id], "message_request", `Message request ${parsed.data.response}`, parsed.data.response === "accepted" ? "You can now exchange private coordination messages." : "The recipient declined the private conversation.", "/messages", user.id, `${conversation.data.id}:${parsed.data.response}`);
    revalidatePath("/messages");
    return { ok: true, message: `Request ${parsed.data.response}.` };
  } catch (error) { return fail(error instanceof Error ? error.message : "Response failed."); }
}

export async function sendDirectMessage(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = directMessageSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const conversation = await service.from("message_conversations").select("id,requester_id,recipient_id,status").eq("id", parsed.data.conversation_id).maybeSingle();
    if (!conversation.data || conversation.data.status !== "accepted" || ![conversation.data.requester_id, conversation.data.recipient_id].includes(user.id)) return fail("Conversation is not available.");
    const other = conversation.data.requester_id === user.id ? conversation.data.recipient_id : conversation.data.requester_id;
    const [blocked, recent] = await Promise.all([
      service.from("account_blocks").select("blocker_id").or(`and(blocker_id.eq.${user.id},blocked_id.eq.${other}),and(blocker_id.eq.${other},blocked_id.eq.${user.id})`).limit(1),
      service.from("direct_messages").select("id", { count: "exact", head: true }).eq("sender_id", user.id).gte("created_at", new Date(Date.now() - 3600000).toISOString()),
    ]);
    if (blocked.data?.length) return fail("Conversation is blocked.");
    if ((recent.count || 0) >= 20) return fail("Hourly message limit reached. Try again later.");
    const sent = await service.from("direct_messages").insert({ conversation_id: conversation.data.id, sender_id: user.id, body: parsed.data.body }).select("id").single();
    if (sent.error) throw sent.error;
    await activity(service, user.id, "direct_message_sent", conversation.data.id, sent.data.id);
    await service.from("message_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.data.id);
    await notify(service, [other], "direct_message", "New private coordination message", "A contributor sent a message in an accepted conversation.", "/messages", user.id, sent.data.id);
    revalidatePath("/messages");
    return { ok: true, message: "Message sent." };
  } catch (error) { return fail(error instanceof Error ? error.message : "Message failed."); }
}

export async function closeOrBlockConversation(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = conversationSchema.safeParse(Object.fromEntries(form));
    const operation = String(form.get("operation") || "close");
    if (!parsed.success || !["close", "block"].includes(operation)) return fail("Invalid conversation action.");
    const conversation = await service.from("message_conversations").select("id,requester_id,recipient_id").eq("id", parsed.data.conversation_id).maybeSingle();
    if (!conversation.data || ![conversation.data.requester_id, conversation.data.recipient_id].includes(user.id)) return fail("Conversation not found.");
    const other = conversation.data.requester_id === user.id ? conversation.data.recipient_id : conversation.data.requester_id;
    if (operation === "block") await service.from("account_blocks").upsert({ blocker_id: user.id, blocked_id: other });
    await service.from("message_conversations").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", conversation.data.id);
    revalidatePath("/messages");
    return { ok: true, message: operation === "block" ? "Account blocked and conversation closed." : "Conversation closed." };
  } catch (error) { return fail(error instanceof Error ? error.message : "Conversation could not be changed."); }
}

export async function reportConversation(_: CommunityState, form: FormData): Promise<CommunityState> {
  try {
    const { user, service } = await context();
    const parsed = reportSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const conversation = await service.from("message_conversations").select("requester_id,recipient_id").eq("id", parsed.data.conversation_id).maybeSingle();
    if (!conversation.data || ![conversation.data.requester_id, conversation.data.recipient_id].includes(user.id)) return fail("Conversation not found.");
    if (parsed.data.message_id) {
      const message = await service.from("direct_messages").select("id").eq("id", parsed.data.message_id).eq("conversation_id", parsed.data.conversation_id).maybeSingle();
      if (!message.data) return fail("Reported message does not belong to this conversation.");
    }
    const report = await service.from("message_reports").insert({ reporter_id: user.id, conversation_id: parsed.data.conversation_id, message_id: parsed.data.message_id || null, reason: parsed.data.reason, details: parsed.data.details });
    if (report.error) return fail(report.error.code === "23505" ? "You already reported this conversation." : "Report could not be submitted.");
    return { ok: true, message: "Report submitted for moderation. Use Block if you also want to stop contact immediately." };
  } catch (error) { return fail(error instanceof Error ? error.message : "Report failed."); }
}

