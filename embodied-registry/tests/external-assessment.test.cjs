const test = require("node:test");
const assert = require("node:assert/strict");
const { externalPolicyAssessmentSchema, externalPolicyAssessments, getExternalPolicyAssessment, publicAssessmentRecord } = require("../.test-build/src/lib/external-assessment.js");

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
    assert.ok(record.assessment.artifact_intents.length > 0);
    assert.match(record.assessment.artifact_intent_notice, /descriptive classification only/i);
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

test("1.6 records keep artifact intent descriptive and all four evidence classes distinct", () => {
  const record = structuredClone(externalPolicyAssessments[0]);
  const claim = {
    category: "evaluation",
    claim: "The upstream model card reports a result under its authors' setup.",
    source_url: record.source.model_card_url,
    source_revision: record.source.revision,
    attribution: "Upstream model card",
  };
  record.binding = {
    algorithm: "sha256",
    manifest_sha256: "a".repeat(64),
    inventory_sha256: "b".repeat(64),
    claims_sha256: "c".repeat(64),
    source_revision: record.source.revision,
  };
  record.upstream_claims = [claim];
  record.evidence_classes = {
    validator_detected_facts: [{ path: "policy.framework", value: "lerobot" }],
    portable_manifest_declarations: [{ path: "skill.source.revision", value: record.source.revision, basis: "Pinned source revision" }],
    upstream_attributed_claims: [claim],
    knownrobot_measured_results: [],
  };

  assert.doesNotThrow(() => externalPolicyAssessmentSchema.parse(record));
  record.evidence_classes.knownrobot_measured_results.push({ success_rate: 1 });
  assert.throws(() => externalPolicyAssessmentSchema.parse(record));
});
