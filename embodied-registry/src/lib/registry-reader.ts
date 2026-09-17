import type { SupabaseClient } from "@supabase/supabase-js";
import { evidenceRecordSchema, registryPageSchema, policyAttemptsSchema, emptyRegistry, type RegistryFilters, type RegistryResult, type EvidenceRecord, type PolicyAttempts } from "./evidence-contract";

export type DetailResult = { state: "live" | "demo"; record: EvidenceRecord; related: EvidenceRecord[]; graph: PolicyAttempts | null } | { state: "missing" | "unconfigured" | "unavailable" };

export async function readRegistry(client: SupabaseClient, filters: RegistryFilters): Promise<RegistryResult> {
  try {
    const { data, error } = await client.rpc("public_registry_page", { p_query: filters.query, p_status: filters.status, p_page: filters.page }).retry(false);
    if (error) return { state: "unavailable", data: emptyRegistry, filters };
    const parsed = registryPageSchema.safeParse(data);
    return parsed.success ? { state: "live", data: parsed.data, filters } : { state: "unavailable", data: emptyRegistry, filters };
  } catch { return { state: "unavailable", data: emptyRegistry, filters }; }
}

export async function readEvaluation(client: SupabaseClient, id: string, page = 1): Promise<DetailResult> {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id)) return { state: "missing" };
  if (!Number.isInteger(page) || page < 1 || page > 100000) return { state: "unavailable" };
  try {
    const [{ data, error }, related] = await Promise.all([
      client.from("public_registry_records").select("record").eq("id", id).maybeSingle().retry(false),
      client.rpc("public_policy_attempts", { p_id: id, p_page: page }).retry(false),
    ]);
    if (error) return { state: "unavailable" };
    if (!data) return { state: "missing" };
    const parsed = evidenceRecordSchema.safeParse(data.record);
    if (!parsed.success) return { state: "unavailable" };
    if (related.error) return { state: "unavailable" };
    const graph = policyAttemptsSchema.safeParse(related.data);
    return graph.success && graph.data.page === page ? { state: "live", record: parsed.data, related: graph.data.records.map(attempt => attempt.record), graph: graph.data } : { state: "unavailable" };
  } catch { return { state: "unavailable" }; }
}
