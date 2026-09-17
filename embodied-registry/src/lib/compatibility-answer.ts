import { displayStatus, isSimulation, type EvidenceRecord, type PolicyAttempts } from "./evidence-contract";
import { manifestIssues } from "./manifest-contract";

/** Page-scoped, evidence-linked answers. Never silently pool percentages. */
export function compatibilityAnswer(anchor: EvidenceRecord, graph: PolicyAttempts | null) {
  const execution = (record: EvidenceRecord) => isSimulation(record) ? "simulation" : record.evaluation.runtime.execution === "physical" || record.hardware.configuration.execution === "physical" ? "physical" : "unspecified";
  const protocolComplete = (record: EvidenceRecord) => ["reset", "success_predicate", "intervention_policy"].every(key => typeof record.benchmark.protocol[key] === "string" && String(record.benchmark.protocol[key]).trim().length > 0) && typeof record.benchmark.protocol.timeout === "number" && record.benchmark.protocol.timeout > 0;
  const anchorComplete = manifestIssues(anchor.skill.manifest, true).length === 0;
  const unique = new Map<string, { record: EvidenceRecord; same_hardware: boolean; same_protocol: boolean }>();
  unique.set(anchor.id, { record: anchor, same_hardware: true, same_protocol: true });
  for (const attempt of graph?.records ?? []) if (attempt.record.id !== anchor.id) unique.set(attempt.record.id, attempt);
  const evidence = [...unique.values()].map(({ record, same_hardware, same_protocol }) => {
    const issues = manifestIssues(record.skill.manifest, true);
    const comparable = !!graph?.identity.policy && !!graph.identity.hardware && !!graph.identity.protocol && same_hardware && same_protocol &&
      execution(record) !== "unspecified" && execution(record) === execution(anchor) && protocolComplete(record) && protocolComplete(anchor) && issues.length === 0 && anchorComplete;
    return { evaluation_id: record.id, url: `/evaluations/${record.id}`, contributor_id: record.submitter.id,
      publisher: record.skill.owner ?? null, comparable_declarations: comparable,
      execution: execution(record), protocol_complete: protocolComplete(record),
      metadata_complete: issues.length === 0, metadata_issues: issues,
      reported_success_rate: record.evaluation.success_rate, trials: record.evaluation.trial_count,
      status: displayStatus(record), outcome: record.evaluation.runtime.outcome ?? null,
      failures: record.evaluation.runtime.failures ?? null,
      review_consistent: record.review_consistent,
    };
  });
  const comparable = evidence.filter(record => record.comparable_declarations);
  const reviewed = comparable.filter(record => record.review_consistent && ["reproduced", "lab_verified", "certified"].includes(record.status));
  return { format: "knownrobot-compatibility-answer/1.0", evaluation_id: anchor.id,
    identity: graph?.identity ?? null, page: graph?.page ?? 1,
    scope: "Anchor plus the current connected-attempt page; not a registry-wide aggregation.",
    coverage_complete: !!graph?.identity.policy && graph.page === 1 && graph.total === graph.records.length,
    connected_attempts_total: graph?.total ?? null,
    comparable_records_on_page: comparable.length,
    distinct_submitter_accounts_on_page: new Set(comparable.map(record => record.contributor_id)).size,
    reviewed_reproduction_records_on_page: reviewed.length,
    strength: !comparable.length ? "insufficient_complete_metadata" : reviewed.length ? "review_backed_record_evidence" : "self_reported_record_evidence",
    evidence,
    limitations: "Matching declarations are not universal compatibility or physical safety. Accounts are not proven independent teams. Trial counts and percentages are contributor-reported, never reconstructed or pooled. Unknown failures do not mean zero failures. Known simulation and physical evidence are separated; unspecified execution is not comparable. Inspect protocols, deviations and review history before use.",
  };
}
