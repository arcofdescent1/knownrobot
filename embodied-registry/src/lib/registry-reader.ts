import type { SupabaseClient } from "@supabase/supabase-js";
import { evidenceRecordSchema, registryPageSchema, emptyRegistry, type RegistryFilters, type RegistryResult, type EvidenceRecord } from "./evidence-contract";

export type DetailResult = { state: "live" | "demo"; record: EvidenceRecord; related: EvidenceRecord[] } | { state: "missing" | "unconfigured" | "unavailable" };

export async function readRegistry(client: SupabaseClient, filters: RegistryFilters): Promise<RegistryResult> {
  try {
    const { data, error } = await client.rpc("public_registry_page", { p_query: filters.query, p_status: filters.status, p_page: filters.page }).retry(false);
    if (error) return { state: "unavailable", data: emptyRegistry, filters };
    const parsed = registryPageSchema.safeParse(data);
    return parsed.success ? { state: "live", data: parsed.data, filters } : { state: "unavailable", data: emptyRegistry, filters };
  } catch { return { state: "unavailable", data: emptyRegistry, filters }; }
}

export async function readEvaluation(client: SupabaseClient, id: string): Promise<DetailResult> {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) return { state: "missing" };
  try {
    const { data, error } = await client.from("public_registry_records").select("record").eq("id", id).maybeSingle().retry(false);
    if (error) return { state: "unavailable" };
    if (!data) return { state: "missing" };
    const parsed = evidenceRecordSchema.safeParse(data.record);
    if (!parsed.success) return { state: "unavailable" };
    const related = await client.from("public_registry_records").select("record").eq("skill_id", parsed.data.skill.id).neq("id", id).order("published_at", { ascending: false }).limit(30).retry(false);
    if (related.error) return { state: "unavailable" };
    const records = evidenceRecordSchema.array().safeParse((related.data ?? []).map(row => row.record));
    return records.success ? { state: "live", record: parsed.data, related: records.data } : { state: "unavailable" };
  } catch { return { state: "unavailable" }; }
}
