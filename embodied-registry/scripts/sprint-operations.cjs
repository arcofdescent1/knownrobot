/* Repository-backed operations. No tokens or participant details enter browser code. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { sprintSchema, sprintState, commitments, assertSprintTransition } = require("../.test-build/src/lib/sprint-contract.js");
const repo = "arcofdescent1/knownrobot";

function tasks(s, now = new Date()) {
  const state = sprintState(s, now);
  return [
    ["recruit", s.schedule.applicationsOpen, state.ready, "Confirm 3–5 teams, at least two physical setups, three materially different configurations, an event lead and two independent reviewers. Applications alone do not count."],
    ["freeze", s.schedule.applicationsClose, state.ready, "Check pinned policy, pre-trial configuration commits and protocol/schedule consent. Publish the actual roster. Do not start while any readiness blocker remains."],
    ["kickoff", s.schedule.freeze, state.ready && !!s.start, "Event lead records START confirmation binding roster, reviewers, protocol and start time. If not ready by kickoff, publicly postpone and collect fresh schedule consent."],
    ["evidence", s.schedule.kickoff, s.teams.length >= 3 && !state.evidencePending.length, "Obtain an immutable manifest, complete trial ledger, counts, deviations and decisive failures from EVERY team, including blocked, unsafe and withdrawn teams."],
    ["review", s.schedule.evidence, s.teams.length >= 3 && !state.reviewPending.length && !state.evidencePending.length, "Each named independent reviewer checks identity, revision, pre-trial configuration, protocol, counts, safety stops and evidence. Record substantive rationale and accepted/changes_requested public review. Sprint review does not grant registry verification."],
    ["results", s.schedule.review, !!s.session, "Hold a public results session. Publish notes, corrections, credits, failed outcomes and nominated improvements. Lead confirms the immutable notes URL."],
    ["report", s.schedule.results, state.status === "Completed", "Publish the joint report: every team outcome, evidence links, reviewer credits, deviations, corrections and improvement issue links. Lead confirms the report and evidence digest."],
  ].filter(([, due]) => now >= new Date(due)).map(([stage, due, done, instructions]) => ({ stage, due, done, instructions, marker: `<!-- knownrobot-operations:${s.id}:${stage} -->` }));
}

async function api(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${endpoint}`, {
    ...options, signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}), ...options.headers },
  });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}); operations stopped without claiming completion.`);
  return response.status === 204 ? null : response.json();
}

async function verify(s, getComment = id => api(`issues/comments/${id}`)) {
  for (const c of commitments(s)) {
    if (c.digest !== c.expected) throw new Error(`Stale ${c.role} commitment`);
    const id = c.comment.match(/#issuecomment-([0-9]+)$/)[1];
    const actual = await getComment(id);
    if (actual.html_url !== c.comment || actual.user?.login?.toLowerCase() !== c.handle.toLowerCase() || actual.user?.type !== "User" || !actual.body?.split(/\r?\n/).some(line => line.trim() === c.token)) {
      throw new Error(`Unverified ${c.role} commitment: public author, URL or exact consent token does not match`);
    }
  }
}

async function operate(s, request = api, now = new Date()) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN with repository issues:write is required only for operate");
  await verify(s, id => request(`issues/comments/${id}`));
  const existing = [];
  for (let page = 1; ; page++) {
    const batch = await request(`issues?state=all&per_page=100&page=${page}`);
    existing.push(...batch.filter(i => !i.pull_request));
    if (batch.length < 100) break;
    if (page >= 100) throw new Error("Issue inventory exceeds safe limit; no writes performed");
  }
  const state = sprintState(s, now);
  const due = tasks(s, now);
  for (const task of due) if (existing.filter(i => i.body?.includes(task.marker)).length > 1) throw new Error(`Duplicate operating issues for ${task.stage}; no writes performed`);
  for (const task of due) {
    const matches = existing.filter(i => i.body?.includes(task.marker));
    if (matches.length > 1) throw new Error(`Duplicate operating issues for ${task.stage}; resolve before continuing`);
    const found = matches[0];
    if (s.cancelled || task.done) {
      if (found?.state === "open") await request(`issues/${found.number}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: "closed", state_reason: s.cancelled ? "not_planned" : "completed" }) });
      continue;
    }
    const body = `${task.marker}\n## ${s.title}: ${task.stage}\n\n${task.instructions}\n\nAccountable event lead: ${s.lead ? `@${s.lead.handle}` : "NOT APPOINTED — maintainer must recruit and confirm a lead"}.\n\nNamed evidence assignments:\n${s.teams.map(t => `- ${t.name}: @${t.reviewer}`).join("\n") || "None — no teams committed"}\n\nGate opens: ${task.due}.\n\nPublic status: ${state.status}.\n\n${state.blockers.map(b => `- ${b}`).join("\n")}\n\n[Operating record](https://knownrobot.com/sprints/status.json) · [Runbook](https://github.com/${repo}/blob/main/community/sprints/README.md)\n\nThis issue is closed automatically only when the operating record satisfies its gate. Missing human commitments remain blockers.`;
    // Public role attribution works for external practitioners who are not repository collaborators.
    const payload = { title: `${s.id}: ${task.stage}`, body, labels: ["sprint-operations"] };
    if (!found) await request("issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    else if (found.state !== "open" || found.body !== body) await request(`issues/${found.number}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, state: "open" }) });
  }
}

async function main() {
  const mode = process.argv[2];
  if (!["check", "verify", "operate"].includes(mode)) throw new Error("Usage: sprint-operations.cjs check|verify|operate");
  const s = sprintSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "../src/data/sprint-01.json"), "utf8")));
  if (process.env.SPRINT_BASE_REF) {
    if (!/^[a-f0-9]{40}$/.test(process.env.SPRINT_BASE_REF)) throw new Error("SPRINT_BASE_REF must be a full Git commit");
    const file = "embodied-registry/src/data/sprint-01.json";
    const ref = `${process.env.SPRINT_BASE_REF}:${file}`;
    // Missing file is allowed only for the initial operating-record introduction.
    const listing = execFileSync("git", ["ls-tree", process.env.SPRINT_BASE_REF, "--", file], { cwd: path.join(__dirname, "../.."), encoding: "utf8" });
    if (listing.trim()) {
      const previous = sprintSchema.parse(JSON.parse(execFileSync("git", ["show", ref], { cwd: path.join(__dirname, "../.."), encoding: "utf8" })));
      assertSprintTransition(previous, s);
    }
  }
  const state = sprintState(s);
  console.log(JSON.stringify({ state, tasks: tasks(s), commitments: commitments(s) }, null, 2));
  const stale = commitments(s).filter(c => c.digest !== c.expected);
  if (stale.length) throw new Error(`Stale commitments: ${stale.map(c => c.role).join(", ")}`);
  if (mode === "verify") await verify(s);
  if (mode === "operate") await operate(s);
}
module.exports = { tasks, verify, operate };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
