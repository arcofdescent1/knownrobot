import { createHash } from "node:crypto";
import { z } from "zod";

const text = z.string().trim().min(1).max(8000);
const handle = z.string().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/);
const https = z.string().url().refine(value => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; });
const comment = z.string().regex(/^https:\/\/github\.com\/arcofdescent1\/knownrobot\/issues\/[1-9][0-9]*#issuecomment-[1-9][0-9]*$/);
const date = z.iso.datetime({ offset: true });
const immutable = https.refine(value => /\/blob\/[a-f0-9]{40}\//.test(new URL(value).pathname) && new URL(value).hostname === "github.com" || /^\/(?:datasets\/)?[\w.-]+\/[\w.-]+\/(?:resolve|tree)\/[a-f0-9]{40}\//.test(new URL(value).pathname) && new URL(value).hostname === "huggingface.co", "Link a full commit-pinned GitHub blob or Hugging Face file");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const confirmation = z.object({ handle, comment, digest }).strict();
const evidenceRecord = z.object({
  url: https, manifest: immutable, revision: z.string().regex(/^[a-f0-9]{40,64}$/),
  outcome: z.enum(["completed", "failed", "blocked", "unsafe", "withdrawn"]),
  planned: z.number().int().min(10), completed: z.number().int().nonnegative(), successes: z.number().int().nonnegative(),
  failures: z.array(z.object({ description: text, improvement: z.string().regex(/^https:\/\/github\.com\/arcofdescent1\/knownrobot\/issues\/[1-9][0-9]*$/) }).strict()),
  deviations: text, trials: immutable,
}).strict();
function checkCounts(value: z.infer<typeof evidenceRecord>, ctx: z.RefinementCtx) {
  if (value.successes > value.completed || value.completed > value.planned) ctx.addIssue({ code: "custom", message: "Require successes ≤ completed ≤ planned" });
  if (["failed", "blocked", "unsafe", "withdrawn"].includes(value.outcome) && !value.failures.length) ctx.addIssue({ code: "custom", message: "Unsuccessful outcomes require an attributed failure and improvement issue" });
  if (value.outcome === "completed" && value.completed !== value.planned) ctx.addIssue({ code: "custom", message: "Completed outcomes must account for all planned trials" });
}
const review = z.object({ reviewer: handle, comment, evidenceDigest: digest, snapshot: evidenceRecord.superRefine(checkCounts), decision: z.enum(["accepted", "changes_requested"]), rationale: text }).strict();
const evidence = evidenceRecord.extend({ reviews: z.array(review).max(100) }).superRefine(checkCounts);
export const sprintSchema = z.object({
  id: z.string().regex(/^sprint-[a-z0-9-]+$/), title: text,
  updatedAt: date, calendarVersion: z.number().int().nonnegative().max(2147483647),
  policy: z.object({ repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/), revision: z.string().regex(/^[a-f0-9]{40}$/) }).strict(),
  schedule: z.object({ applicationsOpen: date, applicationsClose: date, freeze: date, kickoff: date, evidence: date, review: date, results: date, report: date }).strict(),
  protocol: z.object({ task: text, success: text, reset: text, trials: text, configuration: text, safety: text, comparison: text }).strict(),
  lead: confirmation.nullable(), reviewers: z.array(confirmation).max(10),
  teams: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), name: text, lead: confirmation,
    physical: z.boolean(), configuration: text, configurationUrl: immutable, reviewer: handle, application: z.string().regex(/^https:\/\/github\.com\/arcofdescent1\/knownrobot\/issues\/[1-9][0-9]*$/),
    evidence: evidence.nullable(),
  }).strict()).max(5),
  start: z.object({ at: date, confirmation }).strict().nullable(),
  session: z.object({ notes: immutable, confirmation }).strict().nullable(),
  report: z.object({ url: immutable, confirmation }).strict().nullable(),
  cancelled: z.object({ reason: text, confirmation }).strict().nullable(),
}).strict().superRefine((s, ctx) => {
  const times = Object.values(s.schedule).map(Date.parse);
  if (times.some((time, i) => i > 0 && time <= times[i - 1])) ctx.addIssue({ code: "custom", message: "Milestones must be strictly chronological" });
  const unique = (values: string[]) => new Set(values.map(v => v.toLowerCase())).size === values.length;
  if (!unique(s.teams.map(t => t.id)) || !unique(s.teams.map(t => t.lead.handle))) ctx.addIssue({ code: "custom", message: "Teams and team leads must be distinct" });
  if (!unique(s.reviewers.map(r => r.handle))) ctx.addIssue({ code: "custom", message: "Reviewers must be distinct" });
  if (s.reviewers.some(r => s.teams.some(t => t.lead.handle.toLowerCase() === r.handle.toLowerCase()))) ctx.addIssue({ code: "custom", message: "Evidence reviewers must be independent of participating teams" });
  if (s.reviewers.some(r => r.handle.toLowerCase() === s.policy.repository.split("/")[0].toLowerCase())) ctx.addIssue({ code: "custom", message: "The source publisher cannot independently review this sprint" });
  s.teams.forEach(t => { if (!s.reviewers.some(r => r.handle.toLowerCase() === t.reviewer.toLowerCase())) ctx.addIssue({ code: "custom", message: "Every team requires a named assigned independent reviewer" }); });
  s.teams.forEach(t => { if (t.evidence && t.evidence.revision !== s.policy.revision) ctx.addIssue({ code: "custom", message: "Team evidence must use the exact pinned sprint policy revision" }); });
  for (const c of [s.start?.confirmation, s.session?.confirmation, s.report?.confirmation, s.cancelled?.confirmation]) if (c && c.handle.toLowerCase() !== s.lead?.handle.toLowerCase()) ctx.addIssue({ code: "custom", message: "Only the confirmed event lead can record lifecycle decisions" });
  if ((s.session || s.report) && !s.start) ctx.addIssue({ code: "custom", message: "Session and report require a recorded start" });
  s.teams.forEach(t => t.evidence?.reviews.forEach(r => {
    if (!s.reviewers.some(a => a.handle.toLowerCase() === r.reviewer.toLowerCase())) ctx.addIssue({ code: "custom", message: "Only assigned independent reviewers can review evidence" });
    if (r.snapshot.revision !== s.policy.revision) ctx.addIssue({ code: "custom", message: "Reviewed snapshots must use the exact pinned sprint policy revision" });
  }));
  if (s.start && (Date.parse(s.start.at) < Date.parse(s.schedule.kickoff) || Date.parse(s.start.at) >= Date.parse(s.schedule.evidence))) ctx.addIssue({ code: "custom", message: "Start must fall within the scheduled run window; reschedule before collecting consent" });
});
export type Sprint = z.infer<typeof sprintSchema>;

export function hash(value: unknown): string {
  const canonical = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
    return JSON.stringify(v);
  };
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function protocolDigest(s: Sprint) { return hash({ id: s.id, policy: s.policy, schedule: s.schedule, protocol: s.protocol }); }
export function teamDigest(s: Sprint, team: Sprint["teams"][number]) {
  return hash({ protocol: protocolDigest(s), id: team.id, name: team.name, lead: team.lead.handle, physical: team.physical, configuration: team.configuration, configurationUrl: team.configurationUrl, reviewer: team.reviewer, application: team.application });
}
export function evidenceDigest(e: NonNullable<Sprint["teams"][number]["evidence"]>) {
  const { reviews: _reviews, ...record } = e;
  void _reviews;
  return hash(record);
}
export function commitments(s: Sprint) {
  const p = protocolDigest(s);
  const entries = s.teams.map(t => ({ ...t.lead, expected: teamDigest(s, t), role: `TEAM ${t.id}` }));
  if (s.lead) entries.push({ ...s.lead, expected: p, role: "LEAD" });
  s.reviewers.forEach(r => entries.push({ ...r, expected: p, role: "REVIEWER" }));
  if (s.start) entries.push({ ...s.start.confirmation, expected: hash({ protocol: p, teams: s.teams.map(t => teamDigest(s, t)), reviewers: s.reviewers.map(r => r.handle), at: s.start.at }), role: "START" });
  if (s.session) entries.push({ ...s.session.confirmation, expected: hash({ protocol: p, notes: s.session.notes }), role: "SESSION" });
  if (s.report) entries.push({ ...s.report.confirmation, expected: hash({ protocol: p, url: s.report.url, evidence: s.teams.map(t => t.evidence) }), role: "REPORT" });
  if (s.cancelled) entries.push({ ...s.cancelled.confirmation, expected: hash({ protocol: p, reason: s.cancelled.reason }), role: "CANCEL" });
  s.teams.forEach(t => t.evidence?.reviews.forEach(r => entries.push({ handle: r.reviewer, comment: r.comment, digest: r.evidenceDigest, expected: hash(r.snapshot), role: `REVIEW ${t.id} ${r.decision.toUpperCase()} ${hash(r.rationale)}` })));
  return entries.map(c => ({ ...c, token: `KNOWNROBOT ${s.id} ${c.role} ${c.expected}` }));
}
export function sprintState(s: Sprint, now = new Date()) {
  const errors: string[] = [];
  if (!s.lead) errors.push("Name an event lead with a public confirmation.");
  if (s.teams.length < 3) errors.push(`Confirm at least three teams (${s.teams.length}/3).`);
  if (s.teams.filter(t => t.physical).length < 2) errors.push("Confirm at least two physical-hardware teams.");
  if (new Set(s.teams.map(t => t.configuration.trim().toLowerCase())).size < 3) errors.push("Publish three materially different configurations.");
  if (s.reviewers.length < 2) errors.push("Name two independent evidence reviewers with public confirmations.");
  for (const c of commitments(s)) if (c.digest !== c.expected) errors.push(`Renew ${c.role.toLowerCase()} consent: its content has changed.`);
  for (const field of [s.start?.confirmation, s.session?.confirmation, s.report?.confirmation, s.cancelled?.confirmation]) {
    if (field && field.handle.toLowerCase() !== s.lead?.handle.toLowerCase()) errors.push("Only the confirmed event lead can start, cancel, record the session or publish the report.");
  }
  const evidencePending = s.teams.filter(t => !t.evidence).map(t => t.id);
  const reviewPending = s.teams.filter(t => {
    if (!t.evidence) return true;
    const latest = new Map(t.evidence.reviews.map(r => [r.reviewer.toLowerCase(), r]));
    const reviews = [...latest.values()];
    return !reviews.some(r => r.reviewer.toLowerCase() === t.reviewer.toLowerCase() && r.decision === "accepted" && r.evidenceDigest === evidenceDigest(t.evidence!)) || reviews.some(r => r.decision === "changes_requested" || r.evidenceDigest !== evidenceDigest(t.evidence!));
  }).map(t => t.id);
  const ready = errors.length === 0;
  let status = now < new Date(s.schedule.applicationsClose) ? "Recruiting — kickoff not confirmed" : "Awaiting readiness";
  if (s.cancelled && s.lead && s.cancelled.confirmation.digest === commitments(s).find(c => c.role === "CANCEL")?.expected && s.lead.digest === protocolDigest(s)) status = "Cancelled";
  else if (s.start && ready && now >= new Date(s.start.at)) {
    status = now < new Date(s.schedule.evidence) ? "Running" : evidencePending.length ? "Awaiting team outcomes" : reviewPending.length ? "Evidence review" : !s.session ? "Awaiting results session" : !s.report ? "Awaiting joint report" : "Completed";
  } else if (now >= new Date(s.schedule.kickoff)) status = "Not started — readiness requirements unmet";
  else if (ready) status = "Ready — awaiting event lead start";
  return { status, ready, blockers: errors, evidencePending, reviewPending, protocolDigest: protocolDigest(s) };
}

export function assertSprintTransition(previous: Sprint, next: Sprint) {
  if (hash(previous) === hash(next)) return;
  if (Date.parse(next.updatedAt) <= Date.parse(previous.updatedAt) || next.calendarVersion <= previous.calendarVersion) throw new Error("Operating changes require a newer updatedAt and higher calendarVersion");
  if (previous.id !== next.id) {
    if (!previous.cancelled && sprintState(previous, new Date(next.updatedAt)).status !== "Completed") throw new Error("Finish or explicitly cancel the current cohort before replacing it");
    return;
  }
  if (previous.start) {
    if (protocolDigest(previous) !== protocolDigest(next) || hash(previous.start) !== hash(next.start) || hash(previous.teams.map(t => teamDigest(previous, t))) !== hash(next.teams.map(t => teamDigest(next, t))) || hash(previous.reviewers) !== hash(next.reviewers) || hash(previous.lead) !== hash(next.lead)) throw new Error("Started cohorts have an immutable policy, protocol, schedule, roster and role appointments; cancel and create a separate cohort instead");
  }
  for (const old of previous.teams) {
    const current = next.teams.find(t => t.id === old.id);
    if (old.evidence && !current?.evidence) throw new Error("Submitted team evidence cannot disappear; record a correction or withdrawal");
    if (old.evidence && hash(old.evidence.reviews) !== hash(current!.evidence!.reviews.slice(0, old.evidence.reviews.length))) throw new Error("Review history is append-only; retain earlier attributed snapshots");
  }
  if (previous.cancelled && hash(previous.cancelled) !== hash(next.cancelled)) throw new Error("A published cancellation cannot be erased or rewritten");
}
