const test = require("node:test");
const assert = require("node:assert/strict");
const { externalPolicyAssessments, getExternalPolicyAssessment, publicAssessmentRecord } = require("../.test-build/src/lib/external-assessment.js");

test("ships three pinned, attributable metadata-only assessments", () => {
  assert.equal(externalPolicyAssessments.length, 3);
  assert.deepEqual(externalPolicyAssessments.map(record => record.source.repository), [
    "aadarshram/act_pusht",
    "abdul004/so101_act_policy_v5",
    "lerobot/smolvla_base",
  ]);
  for (const record of externalPolicyAssessments) {
    assert.equal(record.record_type, "external_policy_assessment");
    assert.equal(record.source.license, "Apache-2.0");
    assert.match(record.source.revision, /^[a-f0-9]{40}$/);
    assert.ok(record.source.revision_url.endsWith(record.source.revision));
    assert.equal(record.assessment.method, "metadata_only");
    assert.equal(record.assessment.assessor, "Known Robot");
    assert.equal(record.assessment.executed_policy_code, false);
    assert.equal(record.assessment.evaluated_policy, false);
    assert.equal(record.assessment.established_compatibility, false);
    assert.equal(record.assessment.status, "incomplete");
    assert.equal(record.manifest.evaluations.length, 0);
    assert.equal(record.manifest.compatibility.length, 0);
    assert.ok(record.findings.errors.length > 0);
    assert.ok(record.inspected_files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.ok(record.upstream_claims.every(claim => claim.attribution === "Upstream model card" && claim.source_url.includes(record.source.revision)));
  }
});

test("public report states evidence boundaries and stable artifact URLs", () => {
  const record = getExternalPolicyAssessment("lerobot-smolvla-base-d9f33c9");
  assert.ok(record);
  const report = publicAssessmentRecord(record);
  assert.match(report.notice, /did not author or execute/i);
  assert.equal(report.urls.manifest, `https://knownrobot.com/assessments/${record.slug}/manifest.json`);
  assert.equal(getExternalPolicyAssessment("missing"), null);
});
