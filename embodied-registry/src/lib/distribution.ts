import { z } from "zod";
import { EvidenceRecord, displayStatus, statusLabels, safeEvidenceUrl } from "./evidence-contract";

const sourceCredit = z.array(z.object({ name: z.string().trim().min(1), role: z.enum(["policy-author", "dataset-author", "adapter-author", "evaluation-author"]), source_url: z.string().refine(value => !!safeEvidenceUrl(value)) })).max(100);
export function declaredSourceCredits(record: EvidenceRecord) {
  const result = sourceCredit.safeParse(record.skill.manifest.attribution ?? []);
  return result.success ? result.data : [];
}

export function recordUrl(id: string) { return `https://knownrobot.com/evaluations/${encodeURIComponent(id)}`; }
export function badgeMarkdown(record: EvidenceRecord) {
  const url = recordUrl(record.id);
  return `[![Known Robot evidence](${url}/badge.svg?review=${record.evaluation.review_version})](${url})`;
}
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
export function evidenceBadge(record: EvidenceRecord) {
  const status = displayStatus(record);
  // The stored success rate is reported, not independently reconstructed.
  const family = record.hardware.robot_family.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").slice(0, 60);
  const value = `${statusLabels[status]} · ${family}`;
  const width = Math.max(190, Math.min(650, 105 + value.length * 7));
  const color = status === "self_tested" ? "#72521b" : "#275947";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="${xml(`Known Robot: ${value}`)}"><title>${xml(`Known Robot: ${value}. Open linked evidence, protocol and review history.`)}</title><rect width="${width}" height="28" rx="4" fill="${color}"/><path d="M4 0h98v28H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4" fill="#243039"/><g fill="#fff" font-family="Verdana,Arial,sans-serif" font-size="11" text-anchor="middle"><text x="51" y="18">Known Robot</text><text x="${102 + (width - 102) / 2}" y="18">${xml(value)}</text></g></svg>`;
}
export function contributionCredits(record: EvidenceRecord) {
  return {
    format: "knownrobot-credits/1.0", result: recordUrl(record.id),
    source: { url: record.skill.source_url, revision: record.skill.source_revision, attribution: "Consult the original source for policy and dataset authors; a registry publisher is not necessarily an author." },
    publisher: record.skill.owner ?? null,
    declaredSourceContributors: declaredSourceCredits(record),
    evaluator: { ...record.submitter, contribution: "Submitted evaluation", evidence: recordUrl(record.id) },
    reviewers: record.reviews.map(r => ({ ...r.reviewer_identity, contribution: "Attributable review decision", decision: r.new_status, version: r.review_version, date: r.created_at, rationale: r.rationale, evidence: r.evidence_url })),
    hardwareProfileCreator: record.hardware.creator ?? null,
    notice: "Hardware profile creation is not adapter maintenance or policy authorship. Review credits preserve retractions; they are not endorsements of the current claim.",
  };
}
export function citation(record: EvidenceRecord) {
  return {
    type: "dataset", id: recordUrl(record.id), URL: recordUrl(record.id),
    title: `${record.skill.name}: evaluation on ${record.hardware.robot_family}`,
    author: [{ literal: record.submitter.display_name ?? record.submitter.handle ?? `Contributor ${record.submitter.id}` }],
    issued: { "date-parts": [record.published_at.slice(0, 10).split("-").map(Number)] },
    publisher: "Known Robot", version: record.evaluation.result_digest,
    note: `Evaluation evidence record, not a policy authorship claim. Current status: ${statusLabels[displayStatus(record)]}. Cite the source policy and dataset separately.`,
  };
}
