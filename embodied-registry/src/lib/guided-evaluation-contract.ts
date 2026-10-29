import { z } from "zod";
import { submissionSchema } from "./identity-contract";

const httpsUrl = z.string().url().refine(value => new URL(value).protocol === "https:", "Use an HTTPS URL.");
const jsonObject = z.string().min(2).transform((value, ctx) => {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    ctx.addIssue({ code: "custom", message: "Use a valid JSON object." });
    return z.NEVER;
  }
});

export const guidedEvaluationSchema = z.object({
  artifact_id: z.string().uuid(),
  submission_id: z.string().uuid(),
  relationship: z.enum(["direct", "reproduction", "derivative"]),
  license: z.string().trim().min(1).max(100),
  framework: z.string().trim().min(1).max(100),
  framework_version: z.string().trim().regex(/^[0-9]+(?:\.[0-9]+)+(?:[a-zA-Z0-9.+-]*)?$/, "Use a pinned version such as 0.3.3."),
  architecture: z.string().trim().min(2).max(150),
  robot_family: z.string().trim().min(2).max(100),
  gripper: z.string().trim().min(1).max(150),
  sensors: z.string().trim().min(1).max(1000),
  calibration: z.string().trim().max(1000),
  control_frequency_hz: z.coerce.number().positive().max(10000),
  observation_shape: jsonObject,
  action_shape: jsonObject,
  dependencies: z.string().trim().min(1).max(10000),
  dataset_repository: httpsUrl,
  dataset_revision: z.string().trim().regex(/^[a-f0-9]{40,64}$/i, "Supply the immutable dataset revision."),
  dataset_schema: jsonObject,
  benchmark_name: z.string().trim().min(2).max(150),
  benchmark_version: z.string().trim().min(1).max(100),
  success_criterion: z.string().trim().min(10).max(2000),
  reset_procedure: z.string().trim().min(5).max(2000),
  timeout_seconds: z.coerce.number().positive().max(86400),
  trial_count: z.coerce.number().int().min(1).max(1000000),
  success_count: z.coerce.number().int().min(0),
  runtime_environment: z.string().trim().min(2).max(1000),
  runtime_notes: z.string().trim().min(10).max(4000),
  failure_notes: z.string().trim().max(4000),
  evidence_label: z.string().trim().min(2).max(100),
  evidence_url: httpsUrl,
}).refine(value => value.success_count <= value.trial_count, { path: ["success_count"], message: "Successful trials cannot exceed total trials." });

type ArtifactProvenance = { title: string; summary: string | null; source_url: string; source_provider: string; source_revision: string };
type Evaluator = { display_name: string | null; handle: string | null };

export function buildGuidedEvaluation(form: z.infer<typeof guidedEvaluationSchema>, artifact: ArtifactProvenance, evaluator: Evaluator) {
  const sensors = form.sensors.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean).map((type, index) => ({ type, name: `sensor-${index + 1}`, calibration: form.calibration || null }));
  const dependencies = form.dependencies.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const failures = form.failure_notes.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const evidence = [{ label: form.evidence_label, url: form.evidence_url }];
  const evaluatorName = evaluator.display_name || evaluator.handle || "KnownRobot contributor";
  const payload = {
    name: artifact.title,
    summary: `${form.success_count}/${form.trial_count} successful trials for ${artifact.title} on ${form.robot_family}. Self-reported evidence; not independent verification.`,
    source_url: artifact.source_url,
    source_revision: artifact.source_revision,
    framework: form.framework,
    license: form.license,
    manifest: {
      schema_version: "1.0",
      attribution: [{ name: evaluatorName, role: "evaluation-author", source_url: form.evidence_url }],
      skill: { name: artifact.title, version: artifact.source_revision.slice(0, 12), license: form.license, source: { type: artifact.source_provider === "github" ? "github" : "huggingface", repository: artifact.source_url, revision: artifact.source_revision } },
      policy: { framework: form.framework, framework_version: form.framework_version, architecture: form.architecture, checkpoint: artifact.source_url },
      hardware: { robot_family: form.robot_family, gripper: form.gripper, sensors },
      runtime: { control_frequency_hz: form.control_frequency_hz, observation_shape: form.observation_shape, action_shape: form.action_shape, dependencies, accelerator: null, ros_distribution: null },
      dataset: { repository: form.dataset_repository, revision: form.dataset_revision, schema: form.dataset_schema, license: null },
      compatibility: [],
      evaluations: [{ benchmark: form.benchmark_name, trials: form.trial_count, successes: form.success_count, evaluator: evaluatorName, date: new Date().toISOString().slice(0, 10), environment: form.runtime_environment, evidence: form.evidence_url }],
    },
    robot_family: form.robot_family,
    configuration: { robot_family: form.robot_family, gripper: form.gripper, sensors, calibration: form.calibration || null },
    benchmark_name: form.benchmark_name,
    benchmark_version: form.benchmark_version,
    protocol: { success_criterion: form.success_criterion, reset_procedure: form.reset_procedure, timeout_seconds: form.timeout_seconds },
    trial_count: form.trial_count,
    success_count: form.success_count,
    runtime: { environment: form.runtime_environment, notes: form.runtime_notes, failures },
    evidence,
    team_id: null,
  };
  return submissionSchema.parse(payload);
}
