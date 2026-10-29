import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildActivationJourney } from "./activation-contract";

type ArtifactRef = { slug: string; title: string };
const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function readActivationJourney(service: SupabaseClient, userId: string) {
  const [profile, imports, follows, corrections, requests, attempts, positions, collectionItems, threads, posts] = await Promise.all([
    service.from("profiles").select("handle").eq("id", userId).maybeSingle(),
    service.from("artifact_contributions").select("id,artifacts(slug,title)").eq("contributor_profile_id", userId).in("kind", ["import", "claim"]).order("created_at", { ascending: false }).limit(1),
    service.from("follows").select("id,artifacts(slug,title)").eq("follower_id", userId).not("artifact_id", "is", null).order("created_at", { ascending: false }).limit(1),
    service.from("artifact_contributions").select("id").eq("contributor_profile_id", userId).in("kind", ["correction", "review"]).limit(1),
    service.from("discussion_threads").select("id").eq("author_id", userId).in("kind", ["metadata_correction", "evidence_request", "reproduction_request"]).limit(1),
    service.from("artifact_evaluation_attempts").select("id").eq("attached_by", userId).limit(1),
    service.from("evidence_positions").select("id").eq("reviewer_id", userId).limit(1),
    service.from("collection_items").select("id").eq("added_by", userId).limit(1),
    service.from("discussion_threads").select("id").eq("author_id", userId).limit(1),
    service.from("discussion_posts").select("id").eq("author_id", userId).limit(1),
  ]);
  const results = [profile, imports, follows, corrections, requests, attempts, positions, collectionItems, threads, posts];
  if (results.some(result => result.error)) throw new Error("Your activation progress is temporarily unavailable.");
  const importArtifact = one((imports.data?.[0]?.artifacts ?? null) as ArtifactRef | ArtifactRef[] | null);
  const followedArtifact = one((follows.data?.[0]?.artifacts ?? null) as ArtifactRef | ArtifactRef[] | null);
  const artifact = importArtifact ?? followedArtifact;
  return buildActivationJourney({
    profileComplete: Boolean(profile.data?.handle),
    artifactStarted: Boolean(imports.data?.length || follows.data?.length),
    evidenceAction: Boolean(corrections.data?.length || requests.data?.length || attempts.data?.length || positions.data?.length),
    collaborationAction: Boolean(collectionItems.data?.length || threads.data?.length || posts.data?.length),
    artifactSlug: artifact?.slug,
    artifactTitle: artifact?.title,
  });
}
