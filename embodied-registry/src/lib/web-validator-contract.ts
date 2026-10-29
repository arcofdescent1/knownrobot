import { z } from "zod";
import { parseArtifactUrl } from "./artifact-contract";

export const webValidatorRequestSchema = z.object({
  source_url: z.string().trim().min(1).refine(value => {
    try { parseArtifactUrl(value); return true; } catch { return false; }
  }, "Use a public GitHub repository or Hugging Face model, dataset, or Space URL.").transform(parseArtifactUrl),
  revision: z.string().trim().max(200).regex(/^[A-Za-z0-9._\/-]*$/, "Use a branch, tag, or commit without spaces.").optional(),
});

export type ValidationFinding = {
  code: string;
  group: "Source" | "Documentation" | "Policy" | "Hardware" | "Runtime" | "Dataset" | "Dependencies" | "Evaluation";
  status: "found" | "missing" | "review";
  title: string;
  detail: string;
  recommendation?: string;
};

export type ValidationInput = {
  provider: "github" | "huggingface";
  repository: string;
  url: string;
  revision: string;
  revisionUrl: string;
  title: string;
  summary: string;
  license: string;
  files: Array<{ path: string; text?: string; omitted?: string }>;
};

const hasFile = (input: ValidationInput, names: string[]) => input.files.some(file => names.includes(file.path));
const searchableText = (input: ValidationInput) => input.files.map(file => file.text || "").join("\n").toLowerCase();
const mentions = (text: string, terms: string[]) => terms.some(term => text.includes(term));

export function buildWebValidation(input: ValidationInput) {
  const text = searchableText(input);
  const findings: ValidationFinding[] = [
    { code: "source.immutable_revision", group: "Source", status: "found", title: "Immutable source revision", detail: `${input.provider === "github" ? "GitHub" : "Hugging Face"} resolved the source to ${input.revision.slice(0, 12)}.` },
    hasFile(input, ["README.md"])
      ? { code: "documentation.readme", group: "Documentation", status: "found", title: "Repository documentation", detail: "README.md is present in the inspected revision." }
      : { code: "documentation.readme", group: "Documentation", status: "missing", title: "Repository documentation", detail: "README.md was not found in the approved metadata set.", recommendation: "Add a README describing purpose, setup, hardware, and intended use." },
    input.license || hasFile(input, ["LICENSE", "LICENSE.md"])
      ? { code: "source.license", group: "Source", status: "found", title: "License declaration", detail: input.license ? `Declared license: ${input.license}.` : "A license file is present." }
      : { code: "source.license", group: "Source", status: "missing", title: "License declaration", detail: "No license declaration was detected.", recommendation: "Declare a license in repository metadata or add LICENSE." },
    hasFile(input, ["config.json", "policy_config.json"])
      ? { code: "policy.configuration", group: "Policy", status: "found", title: "Policy configuration", detail: "A recognized policy or model configuration file is present." }
      : { code: "policy.configuration", group: "Policy", status: "missing", title: "Policy configuration", detail: "No config.json or policy_config.json was found.", recommendation: "Publish architecture and framework configuration beside the artifact." },
    hasFile(input, ["robot_config.json"]) || mentions(text, ["robot_type", "so-100", "so100", "so-101", "so101", "hardware"])
      ? { code: "hardware.identity", group: "Hardware", status: "found", title: "Hardware identity", detail: "Recognized robot or hardware metadata was detected. Review it for exact embodiment and end-effector details." }
      : { code: "hardware.identity", group: "Hardware", status: "missing", title: "Hardware identity", detail: "The inspected metadata does not identify a robot configuration.", recommendation: "Declare robot family, end effector, sensors, and calibration references." },
    mentions(text, ["fps", "control_frequency", "control frequency", "observation", "action_features", "input_features", "output_features"])
      ? { code: "runtime.contract", group: "Runtime", status: "found", title: "Runtime contract clues", detail: "Control timing or observation/action metadata was detected. Semantic compatibility still requires review." }
      : { code: "runtime.contract", group: "Runtime", status: "missing", title: "Runtime contract", detail: "No control-frequency or observation/action schema was detected.", recommendation: "Declare controller frequency plus observation and action shapes, semantics, units, and ordering." },
    hasFile(input, ["dataset_info.json"]) || mentions(text, ["dataset_repo_id", "dataset repo", "dataset:", "dataset_id"])
      ? { code: "dataset.provenance", group: "Dataset", status: "found", title: "Dataset provenance", detail: "Dataset metadata or a dataset reference was detected." }
      : { code: "dataset.provenance", group: "Dataset", status: "review", title: "Dataset provenance", detail: "No structured dataset provenance was detected in the approved files.", recommendation: "Link the training dataset and pin its revision and feature schema when applicable." },
    hasFile(input, ["pyproject.toml", "requirements.txt"])
      ? { code: "dependencies.declaration", group: "Dependencies", status: "found", title: "Dependency declaration", detail: "A Python dependency declaration is present. Confirm that versions are pinned or reproducibly resolved." }
      : { code: "dependencies.declaration", group: "Dependencies", status: "missing", title: "Dependency declaration", detail: "No pyproject.toml or requirements.txt was found.", recommendation: "Publish dependency versions or a lockfile for the runtime environment." },
    mentions(text, ["evaluation", "benchmark", "success rate", "success_rate", "trials", "reproduction"])
      ? { code: "evaluation.claims", group: "Evaluation", status: "review", title: "Evaluation claims require evidence review", detail: "Evaluation language was detected. KnownRobot has not executed or independently verified it." }
      : { code: "evaluation.evidence", group: "Evaluation", status: "missing", title: "Evaluation evidence", detail: "No evaluation protocol or results were detected in the approved metadata.", recommendation: "Publish the task, reset procedure, success rule, trial count, failures, and evidence URL." },
  ];
  const found = findings.filter(item => item.status === "found").length;
  const missing = findings.filter(item => item.status === "missing").length;
  const review = findings.length - found - missing;
  const score = Math.round((found / findings.length) * 100);
  return {
    schema: "knownrobot-web-validation/1.0" as const,
    source: { provider: input.provider, repository: input.repository, url: input.url, revision: input.revision, revision_url: input.revisionUrl },
    artifact: { title: input.title, summary: input.summary, license: input.license || null },
    summary: { score, found, missing, review, total: findings.length, label: missing === 0 ? "Metadata ready for human review" : missing <= 3 ? "Useful metadata with gaps" : "Important metadata is missing" },
    findings,
    inspected_files: input.files.map(file => ({ path: file.path, omitted: file.omitted || null })),
    boundary: "Metadata-only inspection. KnownRobot did not execute code, download weights or datasets, test hardware compatibility, establish safety, or verify performance claims.",
  };
}

export type WebValidationResult = ReturnType<typeof buildWebValidation>;
