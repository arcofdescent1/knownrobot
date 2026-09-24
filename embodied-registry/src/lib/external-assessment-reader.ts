import "server-only";
import { cache } from "react";
import { externalPolicyAssessmentSchema, externalPolicyAssessments, type ExternalPolicyAssessment } from "./external-assessment";
import { getPublicSupabaseClient } from "./supabase/server";

export type AssessmentCollection = { state: "database" | "audit-export"; records: ExternalPolicyAssessment[] };

export const listExternalPolicyAssessments = cache(async (): Promise<AssessmentCollection> => {
  const client = getPublicSupabaseClient();
  if (!client) return { state: "audit-export", records: externalPolicyAssessments };
  try {
    const { data, error } = await client.from("external_policy_assessments").select("record").eq("lifecycle", "published").order("published_at", { ascending: false }).limit(1000).retry(false);
    if (error || !Array.isArray(data)) return { state: "audit-export", records: externalPolicyAssessments };
    const parsed = data.map(row => externalPolicyAssessmentSchema.safeParse(row.record));
    if (parsed.some(result => !result.success)) return { state: "audit-export", records: externalPolicyAssessments };
    return { state: "database", records: parsed.map(result => result.data!) };
  } catch {
    return { state: "audit-export", records: externalPolicyAssessments };
  }
});

export const readExternalPolicyAssessment = cache(async (slug: string): Promise<ExternalPolicyAssessment | null> => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const collection = await listExternalPolicyAssessments();
  return collection.records.find(record => record.slug === slug) ?? null;
});
