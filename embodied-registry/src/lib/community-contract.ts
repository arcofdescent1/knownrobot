import { z } from "zod";

export const discussionKindSchema = z.enum([
  "discussion",
  "metadata_correction",
  "compatibility_question",
  "reproduction_request",
  "evidence_request",
  "disputed_finding",
  "maintainer_announcement",
]);

const requestKinds = new Set(["reproduction_request", "evidence_request"]);
export const discussionThreadSchema = z.object({
  artifact_id: z.uuid(),
  kind: discussionKindSchema,
  title: z.string().trim().min(8).max(180),
  body: z.string().trim().min(40).max(5000),
  desired_outcome: z.string().trim().max(1000),
}).superRefine((value, context) => {
  if (requestKinds.has(value.kind) && value.desired_outcome.length < 12)
    context.addIssue({ code: "custom", path: ["desired_outcome"], message: "Describe the concrete result needed in at least 12 characters." });
});

export const discussionPostSchema = z.object({
  thread_id: z.uuid(),
  parent_id: z.union([z.literal(""), z.uuid()]),
  body: z.string().trim().min(10).max(5000),
});

export const discussionStatusSchema = z.object({
  thread_id: z.uuid(),
  status: z.enum(["open", "in_progress", "blocked", "resolved", "closed"]),
  note: z.string().trim().max(1000),
});

const containsUrl = /(?:https?:\/\/|www\.)/i;
export const messageRequestSchema = z.object({
  recipient_handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,38}$/),
  artifact_id: z.uuid(),
  note: z.string().trim().min(20).max(500).refine(value => !containsUrl.test(value), "Message requests cannot contain links."),
});
export const conversationResponseSchema = z.object({ conversation_id: z.uuid(), response: z.enum(["accepted", "declined"]) });
export const directMessageSchema = z.object({ conversation_id: z.uuid(), body: z.string().trim().min(2).max(2000) });
export const conversationSchema = z.object({ conversation_id: z.uuid() });
export const reportSchema = z.object({
  conversation_id: z.uuid(),
  message_id: z.union([z.literal(""), z.uuid()]),
  reason: z.enum(["spam", "harassment", "unsafe_content", "impersonation", "other"]),
  details: z.string().trim().max(2000),
});

export type CommunityState = { ok: boolean; message: string; href?: string };
export const initialCommunityState: CommunityState = { ok: false, message: "" };

