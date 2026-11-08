const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=(file)=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

test("contributor opportunities are real workflows rather than promotional placeholders",()=>{
  const migration=read("supabase/migrations/202611080001_contributor_opportunities.sql");
  const actions=read("src/app/opportunities/actions.ts");
  const page=read("src/app/opportunities/page.tsx");
  assert.match(migration,/create table public\.artifact_review_submissions/);
  assert.match(migration,/create table public\.clinic_submissions/);
  assert.match(migration,/create table public\.evidence_bounty_submissions/);
  assert.match(migration,/success','failure','blocked','unsafe/);
  assert.match(actions,/requireIdentity/);
  assert.match(actions,/recordActivity/);
  assert.match(page,/Correct or confirm one field/);
  assert.doesNotMatch(page,/coming soon|placeholder|TODO/i);
});

test("campaign authentication returns contributors to their intended action",()=>{
  const auth=read("src/app/auth-actions.ts");
  const login=read("src/app/login/page.tsx");
  const form=read("src/components/opportunity-forms.tsx");
  assert.match(auth,/safeNext/);
  assert.match(auth,/redirect\(safeNext\(form\.get\("next"\)\)\)/);
  assert.match(login,/name="next" value=\{next\}/);
  assert.match(form,/login.*next=/s);
});

test("public opportunity data excludes private clinic submissions",()=>{
  const migration=read("supabase/migrations/202611080001_contributor_opportunities.sql");
  assert.doesNotMatch(migration,/clinic_submissions_public_read/);
  assert.match(migration,/grant select on public\.compatibility_clinics,public\.evidence_bounties/);
});

test("artifact review preserves a completed draft through authentication and returns a useful receipt",()=>{
  const form=read("src/components/opportunity-forms.tsx");
  const actions=read("src/app/opportunities/actions.ts");
  const workspace=read("src/components/artifact-workspace.tsx");
  assert.match(form,/sessionStorage\.setItem\(draftKey/);
  assert.match(form,/reportValidity\(\)/);
  assert.match(form,/Create account and publish/);
  assert.match(form,/Your public contributor credit/);
  assert.match(form,/See the published improvement/);
  assert.match(form,/View your public contributor profile/);
  assert.match(actions,/reviewActor/);
  assert.match(actions,/profileHref:`\/people\/\$\{handle\}`/);
  assert.match(actions,/recommendedHref:/);
  assert.match(workspace,/Review metadata/);
});

test("artifact quality is evidence-honest and drives a concrete next action",()=>{
  const quality=read("src/lib/artifact-quality.ts");
  const checklist=read("src/components/artifact-quality-checklist.tsx");
  const page=read("src/app/opportunities/page.tsx");
  assert.match(quality,/Maintainer review/);
  assert.match(quality,/Independent reproduction/);
  assert.match(quality,/Upstream distribution/);
  assert.match(checklist,/not compatibility, safety, performance, or endorsement/i);
  assert.match(page,/least-complete records/);
  assert.match(page,/Recommended/);
  assert.doesNotMatch(quality,/quality score proves|certified compatible/i);
});

test("maintainer reviews, follower notifications, and contributor credit form a retention loop",()=>{
  const actions=read("src/app/opportunities/actions.ts");
  const migration=read("supabase/migrations/202611080001_contributor_opportunities.sql");
  const profile=read("src/app/people/[handle]/page.tsx");
  assert.match(actions,/authority.*maintainer/s);
  assert.match(actions,/notifyFollowers/);
  assert.match(actions,/artifact_integrated/);
  assert.match(migration,/create table public\.artifact_distribution_placements/);
  assert.match(profile,/Repository and model-card integrations/);
});

test("repository distribution accepts attributable external placements and rejects self-links",()=>{
  const contract=read("src/lib/opportunity-contract.ts");
  const form=read("src/components/opportunity-forms.tsx");
  const badge=read("src/app/artifacts/[slug]/badge.svg/route.ts");
  assert.match(contract,/github_readme/);
  assert.match(contract,/huggingface_card/);
  assert.match(contract,/knownrobot\.com/);
  assert.match(form,/registerDistributionPlacement/);
  assert.match(badge,/quality\.complete/);
});

test("first-25 operations use recipient-specific attribution through first value",()=>{
  const migration=read("supabase/migrations/202611080002_acquisition_campaign.sql");
  const redirect=read("src/app/go/[token]/route.ts");
  const attribution=read("src/lib/acquisition-attribution.ts");
  const activity=read("src/lib/platform-service.ts");
  assert.match(migration,/create table public\.acquisition_targets/);
  assert.match(migration,/qualified_visit','signup','reply','first_value','maintainer_action','upstream_placement/);
  assert.doesNotMatch(migration,/ip_address|user_agent|fingerprint/i);
  assert.match(redirect,/kr_acquisition_session/);
  assert.match(attribution,/recordAcquisitionAccountEvent/);
  assert.match(activity,/upstream_placement/);
});

test("operator board enforces the exact seven-day decision metrics",()=>{
  const page=read("src/app/operator/acquisition/page.tsx");
  const operator=read("src/lib/operator-session.ts");
  const actions=read("src/app/operator/acquisition/actions.ts");
  for(const phrase of ["Completed value assets","Personalized invitations","Qualified artifact visits","Replies","External first-value contributors","Maintainer claim or correction","Upstream placement"])assert.match(page,new RegExp(phrase));
  assert.match(page,/assets,25/);
  assert.match(page,/invitations,25/);
  assert.match(page,/visits,10/);
  assert.match(page,/contributors,3/);
  assert.match(operator,/KNOWNROBOT_OPERATOR_EMAILS/);
  assert.match(actions,/Prepare value before contact|value asset/i);
});
