import { getSessionClient } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type ViewerShell = { id: string; email: string; handle: string | null; displayName: string | null; avatar: string; unreadMessages: number; unreadNotifications: number };
export async function readViewerShell(): Promise<ViewerShell | null> {
  const client = await getSessionClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email_confirmed_at) return null;
  const service = getServiceSupabaseClient();
  if (!service) return { id: user.id, email: user.email || "", handle: null, displayName: null, avatar: (user.email?.[0] || "K").toUpperCase(), unreadMessages: 0, unreadNotifications: 0 };
  const [profile, messages, notifications] = await Promise.all([
    service.from("profiles").select("handle,display_name").eq("id", user.id).maybeSingle(),
    service.from("direct_messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null),
    service.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null).not("event_type", "in", "(message_request,direct_message)"),
  ]);
  const name = String(profile.data?.display_name || profile.data?.handle || user.email || "KnownRobot user");
  const initials = name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
  return { id: user.id, email: user.email || "", handle: profile.data?.handle || null, displayName: profile.data?.display_name || null, avatar: initials || "KR", unreadMessages: messages.count || 0, unreadNotifications: notifications.count || 0 };
}
