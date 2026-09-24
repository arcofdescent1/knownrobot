# Verification authority release

The verification harness also exercises the external-assessment lifecycle,
digest generation, immutable publication, append-only deletion guard, and
dedicated assessor identity. Production verification should additionally query
the REST API with the publishable key and confirm that drafts remain invisible.

The `202609160001_verification_authority.sql` migration closes the verification
authorization gap. Apply it after the initial registry migration. This is a
database/API release; the account and result-page interfaces are separate work.
There are no browser-side authority checks on which this boundary depends.

## Security contract

- Every evaluation starts `self_tested`, with zero review version and zero
  reproduction count. Contributors cannot insert or update verification fields.
- Only an authenticated, appointed reviewer can call `review_evaluation`.
  There is no caller-supplied reviewer identity. Appointment status is checked
  in the database on every decision, not trusted from client metadata.
- Reviewers cannot review their own submission, an artifact they own, or an
  artifact owned by an organization in which they are a member.
- Appointments explicitly list allowed verification levels. Reviewers cannot
  grant or retract a level outside their appointment. Revoked appointments cease
  working immediately; revocation and review serialize on the appointment row.
- A promotion requires published artifact, benchmark, and evaluation, evidence,
  an immutable 40/64-character source hash (optionally `sha256:`), and a SHA-256
  result digest. A hash is provenance, not proof that a robot task succeeded.
- Every status transition, including retraction to `self_tested`, appends a
  decision with reviewer identity, appointment, evidence URL, rationale, time,
  and snapshots of the evaluation, artifact, hardware, and benchmark.
- Published evaluations and reviewed dependencies cannot be edited through the
  application. Corrections use a new artifact/evaluation; retractions preserve
  the old evidence and decision history. Database administrators remain trusted
  operators and can restrict visibility for privacy incidents.
- History is append-only, including for ordinary owner UPDATE/DELETE commands.
  Superusers can still alter schema or disable triggers: database administrators
  are outside the application threat boundary.
- Anonymous users cannot read drafts or private evaluations/reviews. Appointed
  reviewers can access submitted evidence, including private evidence, and must
  be appointed accordingly. Public history includes its evidence snapshots;
  contributors must never publish sensitive information in public evaluations.
- Service-role credentials can appoint/revoke reviewers, but cannot directly
  award verification or edit published results. Keep those credentials server-side.
- Reproduction counts are not awarded by this API. A reviewer decision is not a
  new independent reproduction; the separate results workflow must derive counts
  from distinct attributable reproduction records, not reviewer clicks.

## Verification meanings and appointment policy

`self_tested` is an unreviewed contributor report. `runner_verified` requires
reviewed runner records. `reproduced` requires evidence of an independent execution
under a comparable declared protocol, not merely inspection of a video or manifest.
`lab_verified` requires an explicitly approved lab's evaluation evidence.
`certified` requires a named certification program and qualified authority; do not
appoint certification reviewers before such a program exists. Grant the minimum
necessary levels. The API records a human decision; it does not autonomously
verify robot behavior, lab accreditation, or physical safety.

## Test before release

Use a dedicated PostgreSQL 17 test cluster with administrative test credentials.
The harness creates and drops its own uniquely named database, but its Supabase
role bootstrap is cluster-global. **Never run the bootstrap/harness against a
production cluster.** It supplies only Supabase's auth/storage prerequisites;
authorization is exercised by real PostgreSQL roles, grants, triggers, and RLS.

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '55439'
$env:PGUSER = 'postgres'
python embodied-registry/supabase/tests/run_verification.py
```

`psql` must be on PATH. Supply `PGPASSWORD` through the environment if required,
not command arguments or committed files. The `Verification authorization`
GitHub workflow runs the same tests on a fresh PostgreSQL 17 service, including
two concurrent review sessions. Test fixture data is not production seed data.

## Deployment

1. Identify the Known Robot Supabase project explicitly; do not use another
   application's project. Take a database backup and check migration history.
2. Preflight existing claims:

   ```sql
   select id, verification_status from public.evaluations
   where verification_status <> 'self_tested';
   ```

   If rows exist, export them and their evidence for review. With operator approval,
   reset unaudited claims to `self_tested` before migration. The migration fails
   atomically rather than silently discarding or grandfathering claims.
3. From `embodied-registry`, link the identified project with `supabase link
   --project-ref PROJECT_REF`, inspect `supabase db push --dry-run`, then apply
   `supabase db push`. `PROJECT_REF` is the operator-selected deployment target,
   not a hardcoded project belonging to another application.
4. Appoint an actual qualified reviewer using a trusted SQL operator or server
   service-role client. Insert their existing profile UUID, allowed statuses,
   the appointing operator identity, and a substantive appointment reason into
   `public.verification_reviewers`. Do not automatically appoint every account.
5. With real user JWTs on a staging Supabase project, confirm ordinary contributor
   submission succeeds, direct status writes fail, an appointed independent review
   succeeds, public history is readable, and private history is not anonymous-readable.
6. Deploy clients that omit review-controlled columns on inserts/updates. The
   migration refreshes PostgREST's schema cache. Check authorization errors and
   review history after deployment. Do not roll back by restoring permissive grants;
   a forward migration is the safe response to release problems.

## Calling the API

Use a Supabase client authenticated with the reviewer's **user session**, not a
service-role client. Fetch the evaluation's current `review_version`, display its
evidence, and submit a deliberate decision:

```typescript
const { data: review, error } = await supabase.rpc('review_evaluation', {
  p_evaluation_id: evaluation.id,
  p_expected_version: evaluation.review_version,
  p_new_status: 'reproduced',
  p_rationale: rationale,
  p_evidence_url: evidenceUrl,
});
if (error) throw error;
```

Read chronological history with `verification_reviews`, filtered by `evaluation_id`
and ordered by `review_version`. Select summary fields for lists; load
`reviewed_snapshot` for inspecting the exact reviewed record. Return values are
subject to visibility when querying history. Do not cache private responses publicly.

Handle SQLSTATE `42501` as unauthorized/immutable, `22023` as invalid decision or
unready evidence, `P0002` as a missing evaluation, and `40001` as a stale decision:
reload and ask the reviewer to reconsider, rather than silently retrying.

To retract, call the same RPC with `p_new_status: 'self_tested'`, the current
version, correction evidence, and a substantive rationale. To revoke authority,
set the appointment's `revoked_at` through the trusted operator path. Historical
decisions remain attributable after revocation or a profile display-name change.
