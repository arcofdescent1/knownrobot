const test = require("node:test");
const assert = require("node:assert/strict");
const { demoRecord } = require("../.test-build/src/lib/demo-data.js");
const { evidenceBadge, badgeMarkdown, contributionCredits, citation, declaredSourceCredits } = require("../.test-build/src/lib/distribution.js");
const { adaptersSchema, adapterSchema, adapterDigest, adapterState, verifyAdapter } = require("../.test-build/src/lib/adapter-contract.js");
const { pageMetadata, registryMetadata, publicPages } = require("../.test-build/src/lib/seo.js");
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
