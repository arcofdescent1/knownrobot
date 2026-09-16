import manifest from "../../schema/example.robot-skill.json";
import { evidenceRecordSchema } from "./evidence-contract";

// Explicit format example only. Never substituted for missing live records.
export const demoRecord = evidenceRecordSchema.parse({
  id: "example-so101", published_at: "2026-09-16T00:00:00Z",
  evaluation: { success_rate: 87, trial_count: 100, result_digest: "illustrative-only", runtime: { outcome: "Illustrative result, not a real robot evaluation", failures: ["Example: object slipped during grasp"] }, evidence: [], review_version: 0 },
  submitter: { id: "example-contributor", handle: null, display_name: "Illustrative contributor" },
  skill: { id: "example-policy", slug: "example-so101", name: "SO-101 cube transfer — format example", summary: "Fictional record demonstrating the portable evidence format.", source_url: "", source_revision: manifest.skill.source.revision, framework: "lerobot", license: "apache-2.0", manifest },
  hardware: { id: "example-hardware", robot_family: "SO-101", configuration: manifest.hardware },
  benchmark: { id: "example-task", name: "Illustrative cube transfer", version: "1", protocol: { reset: "Example: place cube at a marked start position", success_predicate: "Example: cube remains in destination zone", intervention_policy: "Example: interventions count as failures" }, source_url: null },
  verification_status: "self_tested", review_consistent: true, reviews: []
});
