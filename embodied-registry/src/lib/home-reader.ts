import "server-only";
import { cache } from "react";
import { getPublicSupabaseClient } from "./supabase/server";
import { listExternalPolicyAssessments } from "./external-assessment-reader";

type ArtifactSummary = { id: string; slug: string; title: string; summary: string | null; artifact_type: string; source_provider: string; source_repository: string };
type CollectionSummary = { id: string; slug: string; title: string; description: string; collection_items: Array<{ count: number }> };

const preferredArtifacts = ["huggingface-abdul004-so101-act-policy-v5", "huggingface-lerobot-smolvla-libero", "huggingface-lerobot-pusht-image"];
const preferredCollections = ["task-specific-act-policies", "official-lerobot-foundations", "base-policies-needing-evidence"];

function curated<T extends { slug: string }>(records: T[], preferred: string[], limit: number) {
  const bySlug = new Map(records.map(record => [record.slug, record]));
  const selected = preferred.flatMap(slug => bySlug.get(slug) ? [bySlug.get(slug)!] : []);
  const selectedSlugs = new Set(selected.map(record => record.slug));
  return [...selected, ...records.filter(record => !selectedSlugs.has(record.slug))].slice(0, limit);
}

export const getHomepageSnapshot = cache(async () => {
  const client = getPublicSupabaseClient();
  const assessmentsPromise = listExternalPolicyAssessments();
  if (!client) {
    const assessments = await assessmentsPromise;
    return { counts: { artifacts: null, collections: null, assessments: assessments.records.length, attempts: null }, artifacts: [] as ArtifactSummary[], collections: [] as Array<Omit<CollectionSummary, "collection_items"> & { itemCount: number }> };
  }

  const [artifactResult, collectionResult, attemptResult, assessments] = await Promise.all([
    client.from("artifacts").select("id,slug,title,summary,artifact_type,source_provider,source_repository", { count: "exact" }).order("updated_at", { ascending: false }).limit(100),
    client.from("collections").select("id,slug,title,description,collection_items(count)", { count: "exact" }).order("updated_at", { ascending: false }).limit(100),
    client.from("artifact_evaluation_attempts").select("id", { count: "exact", head: true }),
    assessmentsPromise,
  ]);

  const artifacts = artifactResult.error ? [] : (artifactResult.data as ArtifactSummary[] || []);
  const collections = collectionResult.error ? [] : (collectionResult.data as CollectionSummary[] || []);
  return {
    counts: {
      artifacts: artifactResult.error ? null : artifactResult.count ?? artifacts.length,
      collections: collectionResult.error ? null : collectionResult.count ?? collections.length,
      assessments: assessments.records.length,
      attempts: attemptResult.error ? null : attemptResult.count ?? 0,
    },
    artifacts: curated(artifacts, preferredArtifacts, 3),
    collections: curated(collections, preferredCollections, 3).map(collection => ({ ...collection, itemCount: collection.collection_items?.[0]?.count ?? 0 })),
  };
});
