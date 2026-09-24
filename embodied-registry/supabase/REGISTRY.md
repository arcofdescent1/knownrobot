# Public evidence registry release

## External policy assessments

`external_policy_assessments` is deliberately separate from skills, hardware,
benchmarks, evaluations, verification reviews, and compatibility-graph edges.
Each Hugging Face provider/repository/revision can appear once. A verified admin
bundle must move through `draft`, `review`, and `published` in order. Review
freezes the record for publication; published rows cannot be updated or deleted.

The accountable assessor is an `assessment_assessors` identity, not an inferred
policy author or evaluator. Anonymous and authenticated clients can read only
published rows. Only the service role can create or advance records. Published
records are exported with `robot-skill export-assessments` so database state has
a reviewable source-controlled audit copy.

Apply `202609160002_public_evidence_registry.sql` after both earlier migrations,
on the explicitly identified Known Robot project. This migration contains no seed
evaluations, fictional successes, or invented participants.

## Public-data boundary

`public_registry_records` is an invoker-security view. It requires public visibility
and published evaluation, skill, and benchmark, even when a reviewer can read
private records elsewhere. The website uses only an anonymous/public Supabase
client, never a service-role credential or user session. Detail IDs are UUIDs.
Private, draft, and nonexistent IDs receive the same missing-record experience.

Trust labels require an attributable matching current review, result digest, and
policy revision. Inconsistent history is downgraded to self-reported. Human review
and hardware execution are distinct; additional published attempts are not counted
as independent reproductions without reviewed evidence. Null success rates stay
null. Trial counts are displayed as reported, not used to invent success counts
from rounded percentages. No safety certification is implied.

## Configuration and states

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel for the
identified project. No service-role key is needed for public reads. Leave
`KNOWNROBOT_REGISTRY_MODE` unset in production. Explicit `demo` mode shows one
fictional format example with prominent disclaimers and nonindexable detail pages.
It is never a fallback for missing configuration, empty data, or failed queries.

Missing configuration shows an unconnected collection, not invented data. A healthy
empty database shows zero actual published records. Backend failures and malformed
responses show unavailable evidence without fabricated zeros or examples. Failed
detail/download reads return unavailable/503; missing/private IDs return missing/404
(HTML streaming can use a 200 shell with Next's noindex marker).

All reads bypass application fetch caches. Reads have a 10-second request timeout
and no automatic transport retries. Published pages and downloadable JSON records
are dynamic; JSON responses are `no-store`. Removing public visibility therefore
takes effect on the next read. Operators must also configure any upstream CDN to
honor `no-store`; downloaded copies and third-party evidence links are outside the
application's control.

Search covers every published record server-side, with a literal substring filter,
verification filter, and deterministic date/ID pagination of 30 records per page.
Statistics count all visible evaluations, unique hardware profile IDs, and unique
submitter IDs. They do not claim a count of independent labs. Count queries avoid
materializing every record's evidence snapshot.

## Published record contract

Each evaluation has `/evaluations/UUID`, `/evaluations/UUID/manifest.json`, and
`/evaluations/UUID/record.json`. The policy manifest is the stored source manifest;
the complete record additionally binds evaluation runtime, digest, evidence,
hardware, protocol, submitter, and historical reviewer snapshots. These exports do
not turn self-reported claims into verified artifacts.

Use benchmark `protocol` fields `reset`, `success_predicate`, `intervention_policy`,
and `timeout` for readable protocol summaries. Store trial outcomes, failures,
interventions, exclusions, and deviations in evaluation `runtime` using those named
keys. Missing information remains visible; absence of a failure list does not imply
no failures. Evidence can contain HTTPS strings or objects with `url` and `label`.
Other references remain inspectable as raw data but are not made executable links.
Never publish credentials, personal data, or safety-sensitive private material.

Review histories link the rationale and evidence to the exact reviewed snapshots
and the reviewer's appointment. Corrections link to a working public GitHub issue
through a dedicated correction/dispute form with the evaluation ID in its title;
participants include the visible permanent URL and digest. Operators triage issues and qualified reviewers may
retract claims. New trial data requires a new immutable record, not editing history.

## Release verification

- `npm test`, `npm run lint`, and `npm run build` from `embodied-registry`.
- The disposable PostgreSQL harness in `tests/run_verification.py` validates real
  public-view visibility, literal search, pagination, retractions, and verification
  authority. Do not run its bootstrap on a production cluster.
- The `Registry release checks` CI workflow exercises web release checks; the
  verification workflow exercises database checks on PostgreSQL 17.
- Before production cutover, stage actual authenticated submissions and reviewed
  records on Known Robot's Supabase project; verify their anonymous detail/download
  pages, private visibility changes, pagination, and outage behavior through Vercel.

The code does not claim real-world recruitment, ten-policy adoption, or independent
robot experiments merely because these routes pass tests.

## Distribution and credit extension

Apply `202609160003_public_contribution_credit.sql` after the evidence view migration.
It preserves invoker security and the same publication/privacy filters, and adds
existing registry publisher and hardware-profile creator identities. It does not
infer authorship or adapter maintenance, change verification authority, or seed
credits. The website accepts absent optional identity fields as genuinely missing.
Live records expose badge, citation and credit exports; fictional examples cannot
issue these credentials. See `docs/distribution.md` for the release/Action runbook.
