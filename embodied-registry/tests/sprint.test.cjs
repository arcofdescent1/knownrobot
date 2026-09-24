const test = require("node:test");
const assert = require("node:assert/strict");
const { sprintSchema, sprintState, commitments, protocolDigest, teamDigest, evidenceDigest, hash, assertSprintTransition } = require("../.test-build/src/lib/sprint-contract.js");
const { sprintCalendar } = require("../.test-build/src/lib/sprint-calendar.js");
const { communityProof } = require("../.test-build/src/lib/community-proof.js");
const { tasks, verify, operate } = require("../scripts/sprint-operations.cjs");
const source = require("../src/data/sprint-01.json");
const fixture = () => structuredClone(source);
const sha = "a".repeat(40);
const immutable = `https://github.com/example/test/blob/${sha}/record.yaml`;
let seq = 100;
function confirmation(handle, digest) { return { handle, digest, comment: `https://github.com/arcofdescent1/knownrobot/issues/3#issuecomment-${seq++}` }; }
function ready() {
  const s = fixture(); const p = protocolDigest(s);
  s.lead = confirmation("organizer", p);
  s.reviewers = [confirmation("reviewer-one", p), confirmation("reviewer-two", p)];
  s.teams = [0, 1, 2].map(i => ({ id: `team-${i}`, name: `Test team ${i}`, lead: confirmation(`participant-${i}`, sha), physical: i < 2, configuration: `SO101 / camera-${i}`, configurationUrl: immutable, reviewer: "reviewer-one", application: `https://github.com/arcofdescent1/knownrobot/issues/${i + 4}`, evidence: null }));
  s.teams.forEach(t => { t.lead.digest = teamDigest(s, t); });
  return s;
}
function start(s) {
  s.start = { at: s.schedule.kickoff, confirmation: confirmation(s.lead.handle, "0".repeat(64)) };
  s.start.confirmation.digest = commitments(s).find(c => c.role === "START").expected;
}
function outcomes(s) {
  s.teams.forEach(t => {
    t.evidence = { url: t.application, manifest: immutable, revision: s.policy.revision, outcome: "blocked", planned: 10, completed: 0, successes: 0, failures: [{ description: "Calibration absent", improvement: "https://github.com/arcofdescent1/knownrobot/issues/8" }], deviations: "No counted trials; stop before execution", trials: immutable, reviews: [] };
    const { reviews: _reviews, ...snapshot } = t.evidence;
    void _reviews;
    t.evidence.reviews.push({ reviewer: s.reviewers[0].handle, comment: confirmation("reviewer-one", sha).comment, evidenceDigest: evidenceDigest(t.evidence), snapshot: structuredClone(snapshot), decision: "accepted", rationale: "Checked immutable configuration, blocked ledger and zero counts; no reproduction claimed." });
  });
}
test("real record has no invented participants and never auto-starts", () => {
  const s = sprintSchema.parse(source);
  assert.equal(sprintState(s, new Date("2026-09-16")).ready, false);
  assert.equal(sprintState(s, new Date("2026-11-01")).status, "Recruiting — kickoff not confirmed");
});
test("community proof distinguishes reviewed blocked reports from measured reproduction loops", () => {
  assert.equal(communityProof(sprintSchema.parse(source)).established, false);
  const s = ready(); start(s); outcomes(s);
  s.session = { notes: immutable, confirmation: confirmation(s.lead.handle, hash({ protocol: protocolDigest(s), notes: immutable })) };
  s.report = { url: immutable, confirmation: confirmation(s.lead.handle, hash({ protocol: protocolDigest(s), url: immutable, evidence: s.teams.map(t => t.evidence) })) };
  const now = new Date("2027-03-06");
  assert.equal(communityProof(sprintSchema.parse(s), now).operating_status, "Completed");
  assert.equal(communityProof(s, now).established, false);
  assert.equal(communityProof(s, now).reviewed_measured_teams, 0);
  for (const team of s.teams) {
    team.evidence.outcome = "failed"; team.evidence.completed = 10;
    const { reviews, ...snapshot } = team.evidence;
    reviews.push({ ...reviews[0], comment: confirmation("reviewer-one", sha).comment, snapshot: structuredClone(snapshot), evidenceDigest: evidenceDigest(team.evidence), rationale: "Reviewed ten measured failures, not a transfer success claim." });
  }
  s.report.confirmation.digest = commitments(s).find(c => c.role === "REPORT").expected;
  const proof = communityProof(sprintSchema.parse(s), now);
  assert.equal(proof.established, true);
  assert.equal(proof.reviewed_measured_teams, 3);
  assert.equal(proof.reviewed_measured_physical_teams, 2);
  s.teams[0].evidence.reviews.push({ ...s.teams[0].evidence.reviews.at(-1), decision: "changes_requested" });
  assert.equal(communityProof(s, now).established, false);
});
test("readiness requires diversity, hardware, independent reviewers and fresh consent", () => {
  const s = ready(); assert.equal(sprintState(sprintSchema.parse(s)).ready, true);
  s.teams[0].configuration = "Changed cameras";
  assert.equal(sprintState(s).ready, false);
  s.teams[0].lead.digest = teamDigest(s, s.teams[0]);
  s.schedule.kickoff = "2026-09-22T10:00:00-06:00";
  assert.equal(sprintState(s).ready, false);
});
test("invalid lifecycle authority, duplicate leads and self review fail validation", () => {
  const s = ready(); start(s); s.start.confirmation.handle = "intruder";
  assert.equal(sprintSchema.safeParse(s).success, false);
  const x = ready(); x.reviewers[0].handle = x.teams[0].lead.handle;
  assert.equal(sprintSchema.safeParse(x).success, false);
  x.reviewers[0].handle = "legalaspro";
  assert.equal(sprintSchema.safeParse(x).success, false);
  const y = ready(); y.teams[1].lead.handle = y.teams[0].lead.handle;
  assert.equal(sprintSchema.safeParse(y).success, false);
});
test("complete lifecycle preserves blocked attempts, review credits and improvement issues", () => {
  const s = ready(); start(s);
  assert.equal(sprintState(s, new Date("2027-01-26")).status, "Running");
  assert.equal(sprintState(s, new Date("2027-02-16")).status, "Awaiting team outcomes");
  outcomes(s);
  assert.equal(sprintState(s, new Date("2027-02-22")).status, "Awaiting results session");
  s.session = { notes: immutable, confirmation: confirmation(s.lead.handle, hash({ protocol: protocolDigest(s), notes: immutable })) };
  assert.equal(sprintState(s, new Date("2027-02-26")).status, "Awaiting joint report");
  s.report = { url: immutable, confirmation: confirmation(s.lead.handle, hash({ protocol: protocolDigest(s), url: immutable, evidence: s.teams.map(t => t.evidence) })) };
  assert.equal(sprintState(sprintSchema.parse(s), new Date("2027-03-06")).status, "Completed");
});
test("latest review can reopen evidence; changed evidence invalidates earlier review", () => {
  const s = ready(); start(s); outcomes(s);
  const e = s.teams[0].evidence;
  e.reviews.push({ ...e.reviews[0], comment: confirmation("reviewer-one", sha).comment, decision: "changes_requested", rationale: "Missing ledger detail" });
  assert.deepEqual(sprintState(s).reviewPending, ["team-0"]);
  e.successes = 1;
  assert.equal(sprintSchema.safeParse(s).success, false);
});
test("semantic counts, immutable links and milestone order fail closed", () => {
  const s = ready(); outcomes(s); s.teams[0].evidence.successes = 100;
  assert.equal(sprintSchema.safeParse(s).success, false);
  s.teams[0].evidence.successes = 0; s.teams[0].configurationUrl = "https://github.com/example/test/blob/main/config.yaml";
  assert.equal(sprintSchema.safeParse(s).success, false);
  const x = fixture(); x.schedule.review = x.schedule.kickoff;
  assert.equal(sprintSchema.safeParse(x).success, false);
  const y = ready(); outcomes(y); y.teams[0].evidence.revision = sha;
  assert.equal(sprintSchema.safeParse(y).success, false);
});
test("calendar uses stable IDs, UTC and tentative status until actual start", () => {
  const s = fixture(); const text = sprintCalendar(s, new Date("2026-09-16"));
  assert.match(text, /UID:sprint01-kickoff@knownrobot.com/);
  assert.match(text, /DTSTART:20270125T170000Z/);
  assert.equal(text.match(/STATUS:TENTATIVE/g).length, 2);
  for (const line of text.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  const r = ready(); start(r);
  assert.equal(sprintCalendar(r).match(/STATUS:CONFIRMED/g).length, 2);
});
test("public confirmation is authenticated by exact URL, human author and token", async () => {
  const s = ready(); const entries = commitments(s);
  const getter = async id => {
    const c = entries.find(c => c.comment.endsWith(`-${id}`));
    return { html_url: c.comment, user: { login: c.handle, type: "User" }, body: c.token };
  };
  await verify(s, getter);
  await assert.rejects(verify(s, async id => ({ ...await getter(id), user: { login: "intruder", type: "User" } })), /Unverified/);
  await assert.rejects(verify(s, async id => ({ ...await getter(id), body: `I like it: ${(await getter(id)).body}` })), /Unverified/);
  await assert.rejects(verify(s, async () => { throw new Error("API unavailable"); }), /API unavailable/);
});
test("operating loop covers seven gates with stable idempotency markers", () => {
  const s = fixture(); const due = tasks(s, new Date("2027-03-10"));
  assert.deepEqual(due.map(t => t.stage), ["recruit", "freeze", "kickoff", "evidence", "review", "results", "report"]);
  assert.equal(due.every(t => !t.done), true);
  assert.deepEqual(tasks(s, new Date("2027-03-11")).map(t => t.marker), due.map(t => t.marker));
});
test("corrections preserve attributable snapshots without invalidating historical consent", () => {
  const s = ready(); start(s); outcomes(s);
  const e = s.teams[0].evidence;
  const original = structuredClone(e.reviews[0]);
  e.deviations = "Corrected description of calibration blocker";
  assert.equal(commitments(s).every(c => c.expected === c.digest), true);
  assert.deepEqual(sprintState(s).reviewPending, ["team-0"]);
  const { reviews: _reviews, ...snapshot } = e;
  void _reviews;
  e.reviews.push({ ...original, snapshot: structuredClone(snapshot), evidenceDigest: evidenceDigest(e), comment: confirmation("reviewer-one", sha).comment, rationale: "Rechecked corrected description against the immutable ledger" });
  assert.deepEqual(sprintState(s).reviewPending, []);
  assert.deepEqual(e.reviews[0], original);
});
test("confirmed lead can cancel before teams are recruited", () => {
  const s = fixture(); s.lead = confirmation("organizer", protocolDigest(s));
  s.cancelled = { reason: "Insufficient committed teams; reschedule rather than claim a start", confirmation: confirmation("organizer", hash({ protocol: protocolDigest(s), reason: "Insufficient committed teams; reschedule rather than claim a start" })) };
  assert.equal(sprintState(sprintSchema.parse(s)).status, "Cancelled");
  assert.equal(sprintCalendar(s).match(/STATUS:CANCELLED/g).length, 2);
});
test("issue loop resumes closed unmet gates and is idempotent on repeated runs", async () => {
  const originalToken = process.env.GITHUB_TOKEN; process.env.GITHUB_TOKEN = "test-only-not-a-real-token";
  try {
    const s = fixture(); const now = new Date("2027-03-10");
    const issues = [{ number: 1, state: "closed", body: tasks(s, now)[0].marker }];
    let writes = 0;
    const request = async (url, options) => {
      if (url.startsWith("issues?")) return structuredClone(issues);
      writes++; const payload = JSON.parse(options.body);
      if (url === "issues") issues.push({ ...payload, state: "open", number: issues.length + 1 });
      else Object.assign(issues.find(i => `issues/${i.number}` === url), payload);
      return {};
    };
    await operate(s, request, now);
    assert.equal(issues.length, 7); assert.equal(writes, 7); assert.equal(issues[0].state, "open");
    await operate(s, request, now); assert.equal(writes, 7);
    issues.push({ ...issues[0], number: 8 });
    await assert.rejects(operate(s, request, now), /Duplicate/); assert.equal(writes, 7);
    await assert.rejects(operate(s, async () => { throw new Error("API unavailable"); }, now), /API unavailable/);
    assert.equal(writes, 7);
  } finally {
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = originalToken;
  }
});
test("published changes increment calendar revision and started protocols cannot be rewritten", () => {
  const previous = ready(); start(previous); outcomes(previous);
  const next = structuredClone(previous);
  next.updatedAt = "2026-10-01T00:00:00Z"; next.calendarVersion++;
  next.teams[0].evidence.deviations = "Corrected blocked outcome description";
  assert.doesNotThrow(() => assertSprintTransition(previous, next));
  const rewrite = structuredClone(next); rewrite.protocol.success = "Anything counts";
  assert.throws(() => assertSprintTransition(previous, rewrite), /immutable/);
  const erase = structuredClone(next); erase.teams[0].evidence.reviews = [];
  assert.throws(() => assertSprintTransition(previous, erase), /append-only/);
  const stale = structuredClone(next); stale.calendarVersion = previous.calendarVersion;
  assert.throws(() => assertSprintTransition(previous, stale), /calendarVersion/);
  const removed = structuredClone(next); removed.teams.pop();
  assert.throws(() => assertSprintTransition(previous, removed), /immutable/);
});
