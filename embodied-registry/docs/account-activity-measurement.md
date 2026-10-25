# Account activity measurement

KnownRobot's north-star metric is the count of real, non-test, non-bot authenticated accounts that complete at least one qualifying server-recorded workflow during the trailing 30 days. Registrations, pageviews, email opens, analytics events and unauthenticated traffic never count as active accounts.

## Qualifying activity

- completed public contributor profile
- authenticated contributor-workspace return (deduplicated once per UTC day)
- team creation or accepted membership
- evaluation draft saved
- evaluation published
- review contribution or sprint participation when those workflows become native

Account verification is recorded for funnel reporting but is not qualifying activity by itself. Database triggers record durable events at the same trusted write boundaries as profiles, memberships and evaluations. The account workspace records a daily authenticated return through an idempotent RPC.

## Privacy and access

Raw events live in the non-API `private` schema. They contain an internal account UUID, event type, optional related-record UUID, timestamp, coarse channel and deduplication key. They do not contain email addresses, profile fields, form contents, evaluation payloads, IP addresses, device identifiers or third-party analytics identifiers.

Only the Supabase service role can manage exclusions or call `operator_account_activity_summary`. Anonymous and authenticated clients cannot read raw events or aggregate operator reporting. Deleting an authentication account cascade-deletes its event and exclusion rows. Operators must add founder, test, bot and blocked accounts to `private.account_measurement_exclusions`; excluded accounts disappear from all funnel, activation and retention totals without deleting their operational records.

## Reporting contract

Call `operator_account_activity_summary(as_of)` with the service role. The result reports confirmed accounts, activated accounts, trailing-30-day active accounts, 7- and 30-day retained accounts, exclusions, qualifying event volume and coarse channel counts. Unknown attribution remains `direct_or_unknown`; it is never guessed.

Before publishing a scoreboard, record the `as_of` timestamp and preserve the returned JSON as the evidence source. A missing report is `unknown`, never zero.

## Automation access

`GET /api/internal/marketing-metrics` is the only application reporting surface. It requires a bearer credential from the server-only `KNOWNROBOT_REPORTING_TOKEN`, calls the service-role-only aggregate function, validates its response, disables caching and indexing, and returns no raw account records. Per-channel cohorts below five accounts are returned as `null`; top-line operator totals remain exact so milestone accounting cannot silently turn “fewer than five” into zero. Missing credentials, database configuration or malformed database output fail closed.
