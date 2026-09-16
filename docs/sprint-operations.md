# Reproduction sprint operations

Known Robot operates the sprint in public GitHub issues and version-controlled records. No platform account is required to read, apply, or publish a manifest in an existing repository. A public GitHub account is required to make attributable commitments. Applications and interest are not confirmations.

The source of truth is `embodied-registry/src/data/sprint-01.json`; `/sprints`, `/sprints/status.json`, and `/reproduction-sprints.ics` all read it. Empty teams, reviewers and lifecycle decisions mean **not yet committed**, not a simulated community. The pinned policy is a selected public artifact, not a claimed publisher endorsement. The protocol is proposed until all configuration-bound commitments match.

## Commands

Run from `embodied-registry` after `npm ci`:

```sh
npm run sprint:check
npm run sprint:verify
```

`check` validates structure and semantics, prints readiness blockers and all expected consent tokens, and fails for stale commitments. Missing participants are reported as an operational blocker, not a schema error. To prepare a proposed new commitment, enter a 64-character zero digest in the draft PR, run `check`, and read the expected digest/token from its output. This draft correctly fails until the person confirms the token and the digest/comment are recorded. Never merge a placeholder digest.

`verify` additionally retrieves each referenced public GitHub comment, requiring its exact canonical URL, a human author matching the recorded handle, and an exact standalone token line. Quoted interest, checkbox applications, someone else's comment, bot comments, stale consent and API outages fail closed. CI has read-only permissions for this verification; it cannot post recruitment messages or grant verification status.

`operate` is intentionally separate and requires `GITHUB_TOKEN` with repository `issues:write`. The daily workflow runs only the default-branch code. It verifies commitments before writing, inventories open **and closed** issues, uses stable per-sprint/stage markers, creates due operational issues, updates changed blockers, reopens unmet gates, and closes only satisfied/cancelled gates. The monthly workflow still creates the next policy-selection issue, including checking closed issues to avoid duplicates. No automatic action invents participants, approves evidence, selects hardware, sends outreach, or holds a meeting. Inspect workflow failures; a failed API call never means work completed.

## Recruit and freeze

1. Invite practitioners to the public application form. Collect a public team name, accountable GitHub lead, robot/gripper/cameras/compute and a realistic plan. Do not collect private emails, serial numbers or facility-sensitive details in public issues.
2. Appoint a named event lead and at least two independent reviewers. Reviewers must not participate in the sprint teams or independently review their own source artifact. They personally confirm that they have no involvement in the evaluated work or conflicting organizational relationship; maintainers must check this, not merely compare handles. The reviewer token acknowledges this responsibility and the entire protocol.
3. Select three to five teams with at least two physical setups and three materially different configurations. Assign each team's `reviewer` to a personally confirmed independent reviewer. Publish each pre-trial configuration in a full commit-pinned GitHub blob or Hugging Face file. Name the actual configuration, not a marketing category. Human reviewers assess meaningful diversity; the software also rejects identical declarations.
4. Add draft `lead`, `reviewers` and `teams` records. Run `check` to obtain expected tokens. Each named person posts their own exact token as a standalone line in a public issue comment in this repository. Team tokens bind identity/configuration/application and the protocol; role tokens bind the policy, protocol and schedule. Record that comment URL and expected digest in the PR. Do not copy a comment made by the event lead into another person's commitment.
5. Run `verify`, inspect the public comments and configurations, and merge only reviewed records. Configure repository branch protection to require **Sprint commitments / validate** and maintainer review for operating-record changes. This repository data is a curated record, not an untrusted anonymous submission API. Vercel should deploy only the protected default branch. The code does not configure account-level branch protection or bypass it.

Any policy, protocol, schedule or team-configuration change invalidates old consent. Before counted runs, collect fresh commitments. Once started, do not rewrite the protocol or erase teams: stop or cancel the cohort with an attributable reason, preserve the original record, and arrange a separately labeled cohort. Teams changing configuration must not pool their trial counts.

## Start and run

With every readiness blocker resolved, the event lead records `start.at` within the scheduled run window, obtains the START token from `check`, personally posts it, and records the comment/digest. START binds the exact roster, assigned reviewers and start time. Calendar entries remain provisional until this decision exists. Passing readiness alone does not auto-start the study. If kickoff arrives without readiness, publicly postpone, change the schedule and renew all affected consents; do not call the event running.

Teams follow the published reset, timeout, success and safety rules. At least ten planned trials are declared before counted trials. Every attempted trial, reset, intervention, exclusion, failure and configuration deviation is preserved in an immutable ledger. Blocked, unsafe and withdrawn attempts may have zero completed trials but still submit their outcome and a failure-linked improvement issue. Counts must satisfy successes ≤ completed ≤ planned. A completed outcome accounts for every planned trial. A stopped run is not silently dropped from the roster.

## Review, results and improvements

For every team, record `evidence`: public result URL, immutable manifest and ledger links, artifact revision, outcome/counts, deviations, and decisive failures mapped to public improvement issues. The assigned named independent reviewer inspects actual evidence (not only YAML structure), records substantive rationale and an accepted/changes_requested decision, and personally posts the generated REVIEW token. It binds the evidence digest, decision and rationale. Each review includes `snapshot`, an exact copy of the evidence record excluding its `reviews` array. Record the public comment and digest of that snapshot; preserve previous reviews in order. Historical consent continues to describe its original snapshot after a correction, but only a current accepted review from the assigned reviewer satisfies the gate. The latest review for each reviewer controls the gate, and outstanding changes block completion. A sprint review **does not grant** `reproduced`, `lab_verified` or `certified` status in the registry; that uses the separately authorized verification workflow.

After outcomes and review, hold the results session and commit public notes preserving corrections, failed attempts and attribution. Record `session.notes` and the lead's SESSION confirmation. Publish a joint report linking every configuration, outcome, immutable artifact/manifest/ledger, reviewer comment, limitations, correction mechanism and improvement issue. Record `report.url` and the lead's REPORT confirmation. Its token binds the report and all recorded evidence/reviews. Completion requires every team outcome, current accepted review, session notes and confirmed report; calendar dates alone cannot complete it.

Use the [independent review issue form](../.github/ISSUE_TEMPLATE/sprint-review.yml) and [joint report template](../community/sprints/joint-report-template.md) to capture these requirements consistently. They are authoring aids, not synthetic evidence or automatically accepted reviews.

Every improvement issue needs an accountable assignee, concrete acceptance test and reference to the originating failure. Track implementation in normal issues/PRs; the report preserves the link even if implementation is deferred. Credit useful failures, adapters and reviewers rather than only successes. Corrections use a public issue and reviewed PR; retain the prior record in Git history and prior review comments, document the changed conclusion, and renew affected review/report consent.

The lead can cancel before readiness by posting a CANCEL token binding the reason and current protocol. Cancelled calendars use `STATUS:CANCELLED`; operating issues close as not planned. Cancellation is visible, not a deletion.

## Release and the next cycle

Every operating-record change requires a newer `updatedAt` and incremented `calendarVersion`. These produce updateable calendar DTSTAMP/SEQUENCE values, including postponements and cancellation. CI compares the proposed record with the PR base or previous pushed commit: started cohorts cannot rewrite the protocol, schedule, roster or role appointments; submitted evidence cannot disappear and prior reviews are append-only. PRs introducing the first operating record have no prior record to compare. Local transition verification can also use `SPRINT_BASE_REF` set to a full existing Git commit.

Run `npm test`, `npm run lint`, `npm run build` and `npm run test:smoke`. Push reviewed code/records to the intended repository and deploy the tested protected branch to Vercel. The GitHub workflows become active only after publication; local implementation does not mean they have run remotely. No Supabase migration is needed for these repository-backed sprint operations.

Preserve completed/cancelled sprint records and reports in `community/sprints/` when selecting the next monthly policy. Update the current JSON record with a new unique sprint ID, immutable policy, genuinely feasible dates and empty uncommitted roster; never carry over consent from a previous sprint. Commit the archived source JSON with the report so historical commitments remain inspectable. The next cohort is a human selection decision, not a synthetic auto-generated community.
