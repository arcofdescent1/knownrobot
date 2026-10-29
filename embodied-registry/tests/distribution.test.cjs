const test = require("node:test");
const assert = require("node:assert/strict");
const { demoRecord } = require("../.test-build/src/lib/demo-data.js");
const { evidenceBadge, badgeMarkdown, contributionCredits, citation, declaredSourceCredits } = require("../.test-build/src/lib/distribution.js");
const { adaptersSchema, adapterSchema, adapterDigest, adapterState, verifyAdapter } = require("../.test-build/src/lib/adapter-contract.js");
const { pageMetadata, registryMetadata, publicPages } = require("../.test-build/src/lib/seo.js");
const { discussionThreadSchema, messageRequestSchema } = require("../.test-build/src/lib/community-contract.js");
const { signUpSchema, loginSchema, passwordUpdateSchema } = require("../.test-build/src/lib/auth-contract.js");
const { inferPolicyFamily, inferHardwareContexts, normalizeDiscoveryFilters } = require("../.test-build/src/lib/discovery-contract.js");
const { buildActivationJourney } = require("../.test-build/src/lib/activation-contract.js");
const { buildWebValidation, webValidatorRequestSchema } = require("../.test-build/src/lib/web-validator-contract.js");
const { readFileSync } = require("node:fs");
const record = () => ({ ...structuredClone(demoRecord), id: "40000000-0000-0000-0000-000000000001" });
function adapter() {
  const a = { id: "test-arm", name: "Test adapter", robotFamily: "Test arm", repository: "https://github.com/example/adapter", revision: "a".repeat(40), scope: "Declared observation adapter", limitations: "Test fixture only; not physical verification", license: "Apache-2.0", tests: `https://github.com/example/adapter/blob/${"a".repeat(40)}/tests.json`, contract: `https://github.com/example/adapter/blob/${"a".repeat(40)}/contract.json`, supportIssue: "https://github.com/example/adapter/issues/1", updatedAt: "2026-09-16T00:00:00Z", expiresAt: "2026-12-01T00:00:00Z", status: "active", maintainers: [{ handle: "test-maintainer", comment: "https://github.com/arcofdescent1/knownrobot/issues/3#issuecomment-123", digest: "0".repeat(64) }] };
  a.maintainers[0].digest = adapterDigest(a); return a;
}
test("badges reflect current evidence, never claim verified percentages, and escape XML", () => {
  const r = record(); r.hardware.robot_family = '<script>alert("x")</script>';
  const svg = evidenceBadge(r);
  assert.match(svg, /Self-reported/); assert.ok(!svg.includes("<script>")); assert.ok(!svg.includes("87"));
  r.verification_status = "certified"; assert.match(evidenceBadge(r), /Self-reported/);
  r.evaluation.review_version = 1; r.reviews = [{ review_version: 1, new_status: "certified" }];
  assert.match(evidenceBadge(r), /Certified/);
  r.review_consistent = false; assert.match(evidenceBadge(r), /Self-reported/);
  assert.match(badgeMarkdown(r), /badge.svg\?review=1/);
  assert.match(badgeMarkdown(r), /\]\(https:\/\/knownrobot.com\/evaluations\//);
});
test("citations credit the evaluator without inventing policy authors or a DOI", () => {
  const r = record(); const c = citation(r);
  assert.equal(c.author[0].literal, r.submitter.display_name); assert.ok(!("DOI" in c));
  assert.equal(c.version, r.evaluation.result_digest); assert.deepEqual(c.issued["date-parts"], [[2026, 9, 16]]);
  assert.equal(contributionCredits(r).publisher, null); assert.equal(contributionCredits(r).reviewers.length, 0);
});
test("simulation evidence stays explicit in shareable badges and citations", () => {
  const r = record(); r.evaluation.runtime.execution="simulation";
  assert.match(evidenceBadge(r),/Simulation · Self-reported/);
  assert.match(citation(r).title,/simulation evaluation/);
  delete r.evaluation.runtime.execution; r.hardware.configuration.execution="simulation";
  assert.match(evidenceBadge(r),/Simulation/);
});
test("source authors require explicit attributable declarations and safe links", () => {
  const r = record(); r.skill.manifest.attribution = [{ name: "Original author", role: "policy-author", source_url: "https://example.org/paper" }];
  assert.equal(declaredSourceCredits(r).length, 1);
  r.skill.manifest.attribution[0].source_url = "javascript:alert(1)";
  assert.deepEqual(declaredSourceCredits(r), []);
});
test("adapter ownership is bounded, expiring and never inferred from a hardware profile", () => {
  const a = adapterSchema.parse(adapter());
  assert.equal(adapterState(a, new Date("2026-09-20")), "Maintainer-confirmed scope");
  assert.equal(adapterState(a, new Date("2027-01-01")), "Ownership confirmation not current");
  a.scope = "Different support promise"; assert.equal(adapterState(a), "Unconfirmed ownership");
  const invalid = adapter(); invalid.expiresAt = "2027-12-01T00:00:00Z";
  assert.equal(adapterSchema.safeParse(invalid).success, false);
  assert.equal(adaptersSchema.safeParse([adapter(), adapter()]).success, false);
  assert.equal(adaptersSchema.parse(require("../src/data/adapters.json")).length, 0);
});
test("adapter confirmation requires the actual human comment author and exact digest", async () => {
  const a = adapter(); const m = a.maintainers[0];
  const comment = { html_url: m.comment, user: { login: m.handle, type: "User" }, body: `KNOWNROBOT ADAPTER ${a.id} ${adapterDigest(a)}` };
  await verifyAdapter(a, async () => comment);
  await assert.rejects(verifyAdapter(a, async () => ({ ...comment, user: { login: "impostor", type: "User" } })), /Unverified/);
  await assert.rejects(verifyAdapter(a, async () => { throw new Error("API unavailable"); }), /API unavailable/);
  a.revision = "b".repeat(40); await assert.rejects(verifyAdapter(a, async () => comment), /Stale/);
});
test("public canonical, social URL, title and description agree for every static route", () => {
  for (const route of publicPages) {
    const metadata = pageMetadata(route, "Route-specific title", "Route-specific description");
    assert.equal(metadata.alternates.canonical, `https://knownrobot.com${route}`);
    assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
    assert.equal(metadata.twitter.title, metadata.title);
    assert.equal(metadata.twitter.description, metadata.description);
  }
  for (const path of ["https://evil.example/", "//evil.example/", "/\\evil.example/"]) assert.throws(() => pageMetadata(path, "x", "x"));
});
test("filtered/paged registries self-canonicalize without indexing search-result variants", () => {
  const base = { query: "", status: "", page: 1 };
  assert.equal(registryMetadata(base, "live").robots.index, true);
  for (const state of ["demo", "unconfigured", "unavailable"]) assert.equal(registryMetadata(base, state).robots.index, false);
  const filtered = registryMetadata({ query: "A&B", status: "reproduced", page: 2 }, "live");
  assert.equal(filtered.alternates.canonical, "https://knownrobot.com/?q=A%26B&status=reproduced&page=2");
  assert.equal(filtered.robots.index, false); assert.equal(filtered.robots.follow, true);
});
test("preview/development metadata is noindex even when public content is otherwise indexable", () => {
  const previous = process.env.VERCEL_ENV;
  try {
    for (const value of ["preview", "development"]) {
      process.env.VERCEL_ENV = value;
      assert.equal(pageMetadata("/thesis", "Thesis", "Description").robots.index, false);
    }
  } finally { if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous; }
});
test("artifact discussions require substantive context and structured request outcomes", () => {
  const base = { artifact_id: "40000000-0000-4000-8000-000000000001", kind: "discussion", title: "Controller-frequency mismatch", body: "Observed a controller-frequency mismatch while comparing the pinned configuration metadata.", desired_outcome: "" };
  assert.equal(discussionThreadSchema.safeParse(base).success, true);
  assert.equal(discussionThreadSchema.safeParse({ ...base, body: "Too short" }).success, false);
  assert.equal(discussionThreadSchema.safeParse({ ...base, kind: "reproduction_request" }).success, false);
  assert.equal(discussionThreadSchema.safeParse({ ...base, kind: "reproduction_request", desired_outcome: "Independent SO-101 attempt with a pinned manifest." }).success, true);
});
test("message requests require shared context language and reject unsolicited links", () => {
  const request = { recipient_handle: "robot-maintainer", artifact_id: "40000000-0000-4000-8000-000000000001", note: "Could we coordinate the missing calibration metadata for this artifact?" };
  assert.equal(messageRequestSchema.safeParse(request).success, true);
  assert.equal(messageRequestSchema.safeParse({ ...request, note: "See https://spam.example for details" }).success, false);
});
test("private messaging is consent gated, rate limited, reportable, and excluded from contributor counts", () => {
  const action = readFileSync("src/app/community-actions.ts", "utf8");
  const migration = readFileSync("supabase/migrations/202610290003_artifact_discussions_and_messages.sql", "utf8");
  assert.match(action, /status !== "accepted"/);
  assert.match(action, />= 3/);
  assert.match(action, />= 20/);
  assert.match(action, /account_blocks/);
  assert.match(action, /message_reports/);
  assert.match(migration, /event_type not in \('account_verified','message_request_sent','direct_message_sent'\)/);
  assert.match(migration, /private messages never qualify/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(migration, /grant select on public\.message_conversations/);
});

test("community table privileges expose only public discussions", () => {
  const migration = readFileSync("supabase/migrations/202610290004_harden_community_privileges.sql", "utf8");
  assert.match(migration, /revoke all on table[\s\S]*message_conversations[\s\S]*direct_messages[\s\S]*from anon, authenticated/i);
  assert.match(migration, /grant select on table[\s\S]*discussion_threads[\s\S]*discussion_posts[\s\S]*discussion_history[\s\S]*to anon, authenticated/i);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|all)[\s\S]*message_conversations[\s\S]*to anon, authenticated/i);
});

test("standard account credentials are validated without custom password storage", () => {
  const strong = "KnownRobot2026";
  assert.equal(signUpSchema.safeParse({ email: "USER@example.com", password: strong, confirm_password: strong, terms: "on" }).success, true);
  assert.equal(signUpSchema.safeParse({ email: "user@example.com", password: "weak", confirm_password: "weak", terms: "on" }).success, false);
  assert.equal(signUpSchema.safeParse({ email: "user@example.com", password: strong, confirm_password: `${strong}!`, terms: "on" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "user@example.com", password: strong }).success, true);
  assert.equal(passwordUpdateSchema.safeParse({ password: strong, confirm_password: strong }).success, true);
});

test("message read state remains private and recipient-specific", () => {
  const migration = readFileSync("supabase/migrations/202610290005_message_read_state.sql", "utf8");
  assert.match(migration, /add column recipient_id uuid/);
  assert.match(migration, /add column read_at timestamptz/);
  assert.match(migration, /set_direct_message_recipient_before_insert/);
  assert.match(migration, /where read_at is null/);
  assert.match(migration, /revoke all on table public\.direct_messages from anon, authenticated/i);
});

test("homepage leads with the live artifact network instead of an empty evaluation registry", () => {
  const homepage = readFileSync("src/app/page.tsx", "utf8");
  const reader = readFileSync("src/lib/home-reader.ts", "utf8");
  assert.match(homepage, /canonical artifacts/i);
  assert.match(homepage, /curated collections/i);
  assert.match(homepage, /metadata assessments/i);
  assert.match(homepage, /measured attempts/i);
  assert.doesNotMatch(homepage, /No public evidence yet/i);
  assert.doesNotMatch(homepage, /listEvaluations/);
  assert.match(reader, /count: "exact"/);
  assert.match(reader, /attemptResult\.error \? null/);
});

test("discovery is browse-first, evidence-honest, and still searchable", () => {
  const page = readFileSync("src/app/discover/page.tsx", "utf8");
  for (const label of ["Featured artifacts", "Browse by policy family", "Browse by documented hardware context", "Browse by evidence status", "Recently updated", "Needs evidence", "Reproduction failures", "Popular collections"]) assert.match(page, new RegExp(label, "i"));
  assert.match(page, /not a compatibility claim/i);
  assert.match(page, /No failure is inferred from missing evidence/i);
  assert.match(page, /Individual follows remain private/i);
  assert.equal(inferPolicyFamily({ title: "SO-101 ACT policy" }), "act");
  assert.equal(inferPolicyFamily({ title: "SmolVLA LIBERO" }), "smolvla");
  assert.deepEqual(inferHardwareContexts({ title: "SO-101 ACT policy" }), ["so101"]);
  assert.deepEqual(inferHardwareContexts({ title: "PushT dataset" }), ["simulation"]);
  assert.equal(normalizeDiscoveryFilters({ family: "unknown", evidence: "needs-evidence", q: "  ACT  " }).family, undefined);
  assert.equal(normalizeDiscoveryFilters({ evidence: "needs-evidence" }).evidence, "needs-evidence");
});

test("contributor activation always exposes one truthful recommended next step", () => {
  const empty = buildActivationJourney({ profileComplete: false, artifactStarted: false, evidenceAction: false, collaborationAction: false });
  assert.equal(empty.completed, 0);
  assert.equal(empty.percent, 0);
  assert.equal(empty.recommended.id, "profile");
  assert.equal(empty.recommended.href, "/settings/profile");
  const started = buildActivationJourney({ profileComplete: true, artifactStarted: true, evidenceAction: false, collaborationAction: false, artifactSlug: "test-artifact", artifactTitle: "Test artifact" });
  assert.equal(started.completed, 2);
  assert.equal(started.percent, 50);
  assert.equal(started.recommended.id, "evidence");
  assert.equal(started.recommended.href, "/artifacts/test-artifact/discussions");
  const complete = buildActivationJourney({ profileComplete: true, artifactStarted: true, evidenceAction: true, collaborationAction: true });
  assert.equal(complete.complete, true);
  assert.equal(complete.percent, 100);
  assert.equal(complete.recommended.href, "/discover?evidence=needs-evidence");
  const dashboard = readFileSync("src/app/dashboard/page.tsx", "utf8");
  const checklist = readFileSync("src/components/activation-checklist.tsx", "utf8");
  assert.match(dashboard, /readActivationJourney/);
  assert.match(checklist, /role="progressbar"/);
  assert.match(checklist, /Recommended next step/);
});

test("web validator pins trusted sources and reports actionable metadata gaps", () => {
  const parsed = webValidatorRequestSchema.parse({ source_url: "https://huggingface.co/example/robot-policy", revision: "main" });
  assert.equal(parsed.source_url.provider, "huggingface");
  assert.equal(parsed.source_url.repository, "example/robot-policy");
  assert.equal(webValidatorRequestSchema.safeParse({ source_url: "https://example.com/private" }).success, false);
  const result = buildWebValidation({
    provider: "huggingface", repository: "example/robot-policy", url: "https://huggingface.co/example/robot-policy",
    revision: "a".repeat(40), revisionUrl: `https://huggingface.co/example/robot-policy/tree/${"a".repeat(40)}`,
    title: "Robot policy", summary: "", license: "apache-2.0",
    files: [{ path: "README.md", text: "SO-101 policy trained on dataset_repo_id. 30 fps evaluation over 20 trials." }, { path: "config.json", text: "{}" }, { path: "requirements.txt", text: "lerobot==1.0" }],
  });
  assert.equal(result.schema, "knownrobot-web-validation/1.0");
  assert.equal(result.source.revision, "a".repeat(40));
  assert.ok(result.summary.score > 0 && result.summary.score < 100);
  assert.equal(result.findings.find(item => item.code === "hardware.identity").status, "found");
  assert.equal(result.findings.find(item => item.code === "evaluation.claims").status, "review");
  assert.match(result.boundary, /did not execute code/i);
  const page = readFileSync("src/app/validator/page.tsx", "utf8");
  const component = readFileSync("src/components/web-validator.tsx", "utf8");
  const route = readFileSync("src/app/api/validator/route.ts", "utf8");
  assert.match(page, /<WebValidator/);
  assert.match(component, /Validate repository/);
  assert.match(component, /Import this pinned artifact/);
  assert.match(route, /content-length/);
  assert.match(route, /no-store/);
});
