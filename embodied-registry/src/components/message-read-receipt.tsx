"use client";
import { useEffect } from "react";
import { markConversationRead } from "@/app/community-actions";
export function MessageReadReceipt({ conversationId }: { conversationId: string }) {
  useEffect(() => { const form = new FormData(); form.set("conversation_id", conversationId); void markConversationRead(form); }, [conversationId]);
  return null;
}
