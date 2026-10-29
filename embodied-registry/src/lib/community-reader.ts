import "server-only";
import { cache } from "react";
import { getPublicSupabaseClient } from "./supabase/server";

export const listArtifactThreads = cache(async (artifactId: string) => {
  const client = getPublicSupabaseClient();
  if (!client) return [];
  const result = await client.from("discussion_threads")
    .select("id,kind,title,body,desired_outcome,status,created_at,updated_at,profiles!discussion_threads_author_id_fkey(handle,display_name),publisher:assessment_assessors!discussion_threads_author_publisher_id_fkey(handle,display_name),discussion_posts(count)")
    .eq("artifact_id", artifactId).order("updated_at", { ascending: false }).limit(100);
  if (result.error) throw new Error("Artifact discussions are temporarily unavailable.");
  return result.data || [];
});

export async function listDiscussionFeed({ kind, status, artifactIds }: { kind?: string; status?: string; artifactIds?: string[] }) {
  const client = getPublicSupabaseClient();
  if (!client) return [];
  if (artifactIds && !artifactIds.length) return [];
  let query = client.from("discussion_threads").select("id,artifact_id,kind,title,body,desired_outcome,status,created_at,updated_at,profiles!discussion_threads_author_id_fkey(handle,display_name),publisher:assessment_assessors!discussion_threads_author_publisher_id_fkey(handle,display_name),artifacts(slug,title),discussion_posts(count)").order("updated_at", { ascending: false }).limit(100);
  if (kind) query = query.eq("kind", kind);
  if (status) query = query.eq("status", status);
  if (artifactIds) query = query.in("artifact_id", artifactIds);
  const result = await query;
  if (result.error) throw new Error("Discussions are temporarily unavailable.");
  return result.data || [];
}

export const readDiscussionThread = cache(async (id: string) => {
  const client = getPublicSupabaseClient();
  if (!client) throw new Error("Discussions are unavailable.");
  const [thread, posts, history] = await Promise.all([
    client.from("discussion_threads").select("*,profiles!discussion_threads_author_id_fkey(handle,display_name),publisher:assessment_assessors!discussion_threads_author_publisher_id_fkey(handle,display_name),artifacts(slug,title,summary)").eq("id", id).maybeSingle(),
    client.from("discussion_posts").select("id,parent_id,body,created_at,author_id,profiles!discussion_posts_author_id_fkey(handle,display_name)").eq("thread_id", id).order("created_at"),
    client.from("discussion_history").select("id,from_status,to_status,note,created_at,profiles!discussion_history_actor_id_fkey(handle,display_name)").eq("thread_id", id).order("created_at", { ascending: false }),
  ]);
  if (thread.error || posts.error || history.error) throw new Error("Discussion is temporarily unavailable.");
  if (!thread.data) return null;
  return { thread: thread.data, posts: posts.data || [], history: history.data || [] };
});

