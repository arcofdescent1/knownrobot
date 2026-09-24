# Changelog

## 1.6.0 — 2026-09-24

- Require one or more descriptive artifact-intent classifications without changing the publication-completeness or compatibility conclusions.
- Add an append-only Supabase assessment registry with draft, review and published lifecycle gates, immutable published records, accountable assessor identity and unique source revisions.
- Add `sync-assessment` for controlled database lifecycle transitions and `export-assessments` for source-controlled audit snapshots.
- Read public assessments from the database with the checked-in export as an availability fallback.
- Restore direct Vercel CLI access and isolate npm/browser tooling caches inside the project.
- Verify downloadable assessment JSON through direct HTTP production smoke tests.

## 1.5.0 — 2026-09-24

- Add durable `check --format assessment --output FILE` reports containing the manifest, complete findings, validator version, file hashes, execution boundary, provenance and evidence-class lanes.
- Add `verify-report` to verify report integrity and the original inspected metadata bytes.
- Add validated, categorized upstream-claim authoring through `assess-hf --claims FILE`.
- Bind attributed claims to the exact model-card revision and keep Known Robot measured results explicitly separate.
- Display detections, declarations, upstream claims and Known Robot measurements separately on assessment pages.

## 1.4.0 — 2026-09-24

- Add `robot-skill assess-hf` for immutable, metadata-only Hugging Face assessments.
- Bind generated manifests and allowlisted source snapshots with SHA-256 inventories.
- Add `robot-skill verify-assessment` for offline bundle integrity checking.
- Add optional atomic publication into the data-driven Known Robot assessment catalog.
- Reject mutable or abbreviated revisions, untrusted repository identifiers, duplicate catalog identities, oversized metadata and non-allowlisted artifacts.

## 1.2.0 — release candidate

- Give public routes self-canonical URLs and matching social metadata; exclude demos, filtered results, exports, errors and preview builds from indexing, with rendered-production and preview-build regression checks.

- Reject impossible trial counts, invalid calendar dates, nonfinite values, malformed shapes, and contradictory dependency pins.
- Unify complete validation requirements; retain an explicit structural/semantic draft-validation level.
- Save manifests beside the target policy, preserve existing inputs, require explicit overwrite, and use atomic writes.
- Keep stdout manifests and stderr diagnostics separate.
- Resolve dependency versions, fingerprint declarations/locks, detect real LeRobot root feature conventions, and report missing evidence without guessing.
- Compare declared target configurations conservatively, including semantic feature contracts; never conflate matches with independent reproduction.
- Add real metadata fixtures, expanded regression coverage, schema parity, and cross-platform installed-wheel CI.
- Add permanent public evidence pages and JSON exports, genuine empty/error/loading states, explicit opt-in examples, database-derived statistics, global search/pagination, and matching-snapshot trust labels.
- Add evidence-linked live badges, CSL citations, portable evaluator/reviewer/source credits, optional source-linked manifest attribution, and existing publisher/hardware-creator credit through a protected public view.
- Add a reusable isolated/no-write GitHub Action with failed-run diagnostic artifacts and cross-platform CI coverage.
- Add public correction/dispute/appeal procedures and forms, and explicitly confirmed, expiring adapter-maintenance records without invented owners.

## 1.1.0 — 2026-09-15

- Rebranded Embodied Registry as Known Robot.
- Made `knownrobot.com` the canonical product origin while preserving legacy links.
- Renamed package, repository, documentation, event, and metadata identities without changing the `robot-skill` command or schema version.

## Phase 4 event system — 2026-09-08

- Launched the monthly Reproduction Sprint operating model and public calendar.
- Opened Sprint 01 around a public ACT SO-101 pick-and-place policy with fixed application, run, review, session, and publication dates.
- Added structured team applications, compatibility-evidence submissions, safety and evidence rules, a report contract, and recurring monthly operations automation.

## 1.0.0 — 2026-09-08

- Released the `robot-skill check` repository inspector and portable YAML generator.
- Added strict CI mode, JSON diagnostics, stable exit codes, and standalone validation.
- Published the robot-skill 1.0 JSON Schema and a complete SO-101 example.
- Added detection for common policy configuration, dependency, Git source, framework, architecture, robot, dataset, sensor, frequency, observation, and action metadata.
- Added automated checks for ten representative robotics repository layouts on Python 3.10 and 3.12.
