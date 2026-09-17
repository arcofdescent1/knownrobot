import "server-only";
import { cache } from "react";
import { getPublicSupabaseClient } from "./supabase/server";
import { emptyRegistry, type RegistryFilters, type RegistryResult } from "./evidence-contract";
import { readRegistry, readEvaluation, type DetailResult } from "./registry-reader";
import { demoRecord } from "./demo-data";

const readPublicList = cache(async (query: string, status: string, page: number): Promise<RegistryResult> => {
  const filters = { query, status, page };
  if (process.env.KNOWNROBOT_REGISTRY_MODE === "demo") {
    const matches = (!filters.query || [demoRecord.skill.name, demoRecord.hardware.robot_family].join(" ").toLowerCase().includes(filters.query.toLowerCase())) && (!filters.status || filters.status === "self_tested");
    return { state: "demo", filters, data: { total: matches ? 1 : 0, stats: { evaluations: 1, hardware: 1, contributors: 1 }, records: matches && filters.page === 1 ? [demoRecord] : [] } };
  }
  try {
    const client = getPublicSupabaseClient();
    if (!client) return { state: "unconfigured", data: emptyRegistry, filters };
    return await readRegistry(client, filters);
  } catch { return { state: "unavailable", data: emptyRegistry, filters }; }
});

export function listEvaluations(filters: RegistryFilters): Promise<RegistryResult> {
  return readPublicList(filters.query, filters.status, filters.page);
}

export const getEvaluation = cache(async (id: string, page = 1): Promise<DetailResult> => {
  if (process.env.KNOWNROBOT_REGISTRY_MODE === "demo") return id === demoRecord.id ? { state: "demo", record: demoRecord, related: [], graph: null } : { state: "missing" };
  try {
    const client = getPublicSupabaseClient();
    return client ? await readEvaluation(client, id, page) : { state: "unconfigured" };
  } catch { return { state: "unavailable" }; }
});
