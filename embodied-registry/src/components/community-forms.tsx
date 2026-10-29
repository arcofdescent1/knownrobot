"use client";
import Link from "next/link";
import { useActionState } from "react";
import {
  closeOrBlockConversation, createDiscussion, replyToDiscussion, reportConversation,
  requestConversation, respondToConversation, sendDirectMessage, updateDiscussionStatus,
} from "@/app/community-actions";
import { initialCommunityState, type CommunityState } from "@/lib/community-contract";

function Result({ state }: { state: CommunityState }) {
  if (!state.message) return null;
  return <div className={state.ok ? "form-success" : "form-error"} role="status"><p>{state.message}</p>{state.href ? <Link href={state.href}>Open →</Link> : null}</div>;
}
function Submit({ pending, label }: { pending: boolean; label: string }) { return <button disabled={pending}>{pending ? "Working…" : label}</button>; }

export function NewDiscussionForm({ artifactId }: { artifactId: string }) {
  const [state, action, pending] = useActionState(createDiscussion, initialCommunityState);
  return <form action={action} className="identity-form" data-analytics-event="discussion_start">
    <input type="hidden" name="artifact_id" value={artifactId} />
    <label>Discussion type<select name="kind" defaultValue="discussion"><option value="discussion">General technical discussion</option><option value="metadata_correction">Metadata correction</option><option value="compatibility_question">Compatibility question</option><option value="reproduction_request">Reproduction request</option><option value="evidence_request">Evidence request</option><option value="disputed_finding">Disputed finding</option><option value="maintainer_announcement">Maintainer announcement</option></select></label>
    <label>Title<input name="title" required minLength={8} maxLength={180} /></label>
    <label>Technical context<textarea name="body" required minLength={40} maxLength={5000} rows={7} /></label>
    <label>Concrete desired outcome <span>(required for reproduction and evidence requests)</span><textarea name="desired_outcome" maxLength={1000} rows={3} /></label>
    <p>Keep evidence and conclusions public. Do not include secrets, personal data, or unsafe robot-operating instructions.</p>
    <Submit pending={pending} label="Publish discussion" /><Result state={state} />
  </form>;
}

export function DiscussionReplyForm({ threadId, parentId = "" }: { threadId: string; parentId?: string }) {
  const [state, action, pending] = useActionState(replyToDiscussion, initialCommunityState);
  return <form action={action} className="identity-form compact-form" data-analytics-event="discussion_reply">
    <input type="hidden" name="thread_id" value={threadId} /><input type="hidden" name="parent_id" value={parentId} />
    <label>{parentId ? "Reply to this contribution" : "Add a public contribution"}<textarea name="body" required minLength={10} maxLength={5000} rows={5} /></label>
    <Submit pending={pending} label="Publish reply" /><Result state={state} />
  </form>;
}

export function DiscussionStatusForm({ threadId, current }: { threadId: string; current: string }) {
  const [state, action, pending] = useActionState(updateDiscussionStatus, initialCommunityState);
  return <form action={action} className="identity-form compact-form">
    <input type="hidden" name="thread_id" value={threadId} />
    <label>Status<select name="status" defaultValue={current}><option value="open">Open</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>
    <label>What changed?<textarea name="note" maxLength={1000} rows={3} /></label>
    <Submit pending={pending} label="Update status" /><Result state={state} />
  </form>;
}

export function MessageRequestForm({ artifactId = "", recipientHandle = "" }: { artifactId?: string; recipientHandle?: string }) {
  const [state, action, pending] = useActionState(requestConversation, initialCommunityState);
  return <form action={action} className="identity-form" data-analytics-event="message_request_start">
    <label>Contributor handle<input name="recipient_handle" required defaultValue={recipientHandle} pattern="[a-z0-9][a-z0-9-]{2,38}" /></label>
    <label>Shared artifact ID<input name="artifact_id" required defaultValue={artifactId} /></label>
    <label>Coordination request<textarea name="note" required minLength={20} maxLength={500} rows={4} /></label>
    <p>Both accounts must already have public activity on this artifact. Requests cannot contain links and are limited to three per day.</p>
    <Submit pending={pending} label="Request private conversation" /><Result state={state} />
  </form>;
}

export function ConversationResponseForm({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState(respondToConversation, initialCommunityState);
  return <form action={action} className="inline-action"><input type="hidden" name="conversation_id" value={conversationId} /><button name="response" value="accepted" disabled={pending}>Accept</button><button name="response" value="declined" disabled={pending} className="secondary-button">Decline</button><Result state={state} /></form>;
}

export function DirectMessageForm({ conversationId }: { conversationId: string }) {
  const [state, action, pending] = useActionState(sendDirectMessage, initialCommunityState);
  return <form action={action} className="identity-form compact-form"><input type="hidden" name="conversation_id" value={conversationId} /><label>Private coordination message<textarea name="body" required minLength={2} maxLength={2000} rows={4} /></label><Submit pending={pending} label="Send message" /><Result state={state} /></form>;
}

export function ConversationSafetyForm({ conversationId }: { conversationId: string }) {
  const [changeState, changeAction, changing] = useActionState(closeOrBlockConversation, initialCommunityState);
  const [reportState, reportAction, reporting] = useActionState(reportConversation, initialCommunityState);
  return <div className="conversation-safety"><form action={changeAction} className="inline-action"><input type="hidden" name="conversation_id" value={conversationId} /><button name="operation" value="close" disabled={changing}>Close conversation</button><button name="operation" value="block" disabled={changing} className="danger-button">Block account</button><Result state={changeState} /></form><details><summary>Report this conversation</summary><form action={reportAction} className="identity-form compact-form"><input type="hidden" name="conversation_id" value={conversationId} /><input type="hidden" name="message_id" value="" /><label>Reason<select name="reason"><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="unsafe_content">Unsafe content</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select></label><label>Details<textarea name="details" maxLength={2000} rows={3} /></label><Submit pending={reporting} label="Submit report" /><Result state={reportState} /></form></details></div>;
}

