import { z } from "zod";
import recordsJson from "../data/external-policy-assessments.json";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const httpsUrl = z.string().url().refine(value => value.startsWith("https://"), "HTTPS URL required");

const findingSchema = z.object({
  severity: z.enum(["error", "warning"]),
  path: z.string().min(1),
  message: z.string().min(1),
});
const detectedFactSchema = z.object({ path: z.string().min(1), value: z.unknown() });
const declarationSchema = detectedFactSchema.extend({ basis: z.string().min(1) });
const upstreamClaimSchema = z.object({
  category: z.enum(["task", "hardware", "training", "evaluation", "limitation", "intended_use", "other"]).optional(),
  claim: z.string().min(1).max(1000), source_url: httpsUrl,
  source_revision: commit.optional(), attribution: z.literal("Upstream model card"),
});
const artifactIntentSchema = z.enum(["task_policy", "base_policy", "training_checkpoint", "simulation_policy", "hardware_policy"]);
export const artifactIntentLabels: Record<z.infer<typeof artifactIntentSchema>, string> = {
  task_policy: "Task policy", base_policy: "Base policy", training_checkpoint: "Training checkpoint",
  simulation_policy: "Simulation policy", hardware_policy: "Hardware policy",
};

export const externalPolicyAssessmentSchema = z.object({
  record_type: z.literal("external_policy_assessment"),
  schema_version: z.literal("1.0"),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  source: z.object({
    provider: z.literal("huggingface"),
    repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
    revision: commit,
    repository_url: httpsUrl,
    revision_url: httpsUrl,
    model_card_url: httpsUrl,
    author: z.string().min(1),
    license: z.string().min(1),
  }),
  assessment: z.object({
    method: z.literal("metadata_only"),
    assessor: z.literal("Known Robot"),
    validator_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    assessed_at: z.string().datetime(),
    executed_policy_code: z.literal(false),
    evaluated_policy: z.literal(false),
    established_compatibility: z.literal(false),
    status: z.enum(["complete", "incomplete"]),
    artifact_intents: z.array(artifactIntentSchema).min(1).max(5).refine(items => new Set(items).size === items.length, "Artifact intents must be unique"),
    artifact_intent_notice: z.literal("Descriptive classification only; it is not a compatibility, performance, safety or deployment conclusion."),
  }),
  binding: z.object({ algorithm: z.literal("sha256"), manifest_sha256: sha256, inventory_sha256: sha256, claims_sha256: sha256.optional(), source_revision: commit }).optional(),
  manifest: z.record(z.string(), z.unknown()),
  findings: z.object({ errors: z.array(findingSchema), warnings: z.array(findingSchema) }),
  inspected_files: z.array(z.object({ path: z.string().min(1), sha256, bytes: z.number().int().nonnegative() })).min(1),
  upstream_claims: z.array(upstreamClaimSchema),
  evidence_classes: z.object({
    validator_detected_facts: z.array(detectedFactSchema),
    portable_manifest_declarations: z.array(declarationSchema),
    upstream_attributed_claims: z.array(upstreamClaimSchema),
    knownrobot_measured_results: z.array(z.never()).length(0),
  }).optional(),
  limitations: z.array(z.string().min(1)).min(1),
});

export type ExternalPolicyAssessment = z.infer<typeof externalPolicyAssessmentSchema>;

export const externalPolicyAssessments = z.array(externalPolicyAssessmentSchema).min(1).parse(recordsJson);

export function getExternalPolicyAssessment(slug: string) {
  return externalPolicyAssessments.find(record => record.slug === slug) ?? null;
}

export function publicAssessmentRecord(record: ExternalPolicyAssessment) {
  return {
    ...record,
    notice: "Metadata assessment only. Known Robot did not author or execute this policy and is not reporting an evaluation or compatibility result.",
    urls: {
      record: `https://knownrobot.com/assessments/${record.slug}`,
      manifest: `https://knownrobot.com/assessments/${record.slug}/manifest.json`,
      report: `https://knownrobot.com/assessments/${record.slug}/report.json`,
    },
  };
}
