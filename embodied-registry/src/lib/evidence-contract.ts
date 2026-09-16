import { z } from "zod";

export const statuses = ["self_tested", "runner_verified", "reproduced", "lab_verified", "certified"] as const;
export const statusLabels = { self_tested: "Self-reported", runner_verified: "Runner verified", reproduced: "Independently reproduced", lab_verified: "Lab verified", certified: "Certified" };
const jsonObject = z.record(z.string(), z.json());
const identity = z.object({ id: z.string(), handle: z.string().nullable(), display_name: z.string().nullable() });
const publisher = z.object({ id: z.string(), kind: z.enum(["profile", "organization"]), name: z.string().nullable(), handle: z.string().nullable() });
export const evidenceRecordSchema = z.object({
  id: z.string(), published_at: z.string().datetime({ offset: true }),
  evaluation: z.object({ success_rate: z.number().min(0).max(100).nullable(), trial_count: z.number().int().positive(),
    result_digest: z.string(), runtime: jsonObject, evidence: z.array(z.json()), review_version: z.number().int().nonnegative() }),
  submitter: identity,
  skill: z.object({ id: z.string(), slug: z.string(), name: z.string(), summary: z.string(), source_url: z.string(),
    source_revision: z.string(), framework: z.string(), license: z.string().nullable(), manifest: jsonObject, owner: publisher.nullable().optional() }),
  hardware: z.object({ id: z.string(), robot_family: z.string(), configuration: jsonObject, creator: identity.nullable().optional() }),
  benchmark: z.object({ id: z.string(), name: z.string(), version: z.string(), protocol: jsonObject, source_url: z.string().nullable() }),
  verification_status: z.enum(statuses), review_consistent: z.boolean(),
  reviews: z.array(z.object({ id: z.string(), reviewer_id: z.string(), reviewer_identity: identity,
    previous_status: z.enum(statuses), new_status: z.enum(statuses), review_version: z.number().int().positive(),
    rationale: z.string(), evidence_url: z.string(), created_at: z.string().datetime({ offset: true }), reviewed_snapshot: jsonObject })),
});
export const registryPageSchema = z.object({ total: z.number().int().nonnegative(),
  stats: z.object({ evaluations: z.number().int().nonnegative(), hardware: z.number().int().nonnegative(), contributors: z.number().int().nonnegative() }),
  records: z.array(evidenceRecordSchema) });
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type RegistryPage = z.infer<typeof registryPageSchema>;
export type RegistryFilters = { query: string; status: string; page: number };
export type RegistryResult = { state: "live" | "demo" | "unconfigured" | "unavailable"; data: RegistryPage; filters: RegistryFilters };
export const emptyRegistry: RegistryPage = { total: 0, stats: { evaluations: 0, hardware: 0, contributors: 0 }, records: [] };

export function parseFilters(input: Record<string, string | string[] | undefined>): RegistryFilters {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const query = (first(input.q) ?? "").trim().slice(0, 200);
  const status = first(input.status) ?? "";
  const pageText = first(input.page) ?? "1";
  return { query, status: statuses.includes(status as typeof statuses[number]) ? status : "",
    page: /^\d+$/.test(pageText) && Number(pageText) >= 1 && Number(pageText) <= 100000 ? Number(pageText) : 1 };
}
export function registryUrl(filters: RegistryFilters, page = filters.page) {
  const query = new URLSearchParams();
  if (filters.query) query.set("q", filters.query);
  if (filters.status) query.set("status", filters.status);
  if (page > 1) query.set("page", String(page));
  return "/" + (query.size ? "?" + query.toString() : "");
}
export function safeEvidenceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function evidenceLinks(record: EvidenceRecord) {
  return record.evaluation.evidence.map((item, index) => {
    const object = item && typeof item === "object" && !Array.isArray(item) ? item : null;
    const raw = object ? object.url : item;
    return { label: object && typeof object.label === "string" ? object.label : `Evidence ${index + 1}`, url: safeEvidenceUrl(raw), reference: raw };
  });
}
export function displayStatus(record: EvidenceRecord) {
  return record.review_consistent && (record.verification_status === "self_tested" || record.reviews.some(r => r.review_version === record.evaluation.review_version && r.new_status === record.verification_status))
    ? record.verification_status : "self_tested";
}
