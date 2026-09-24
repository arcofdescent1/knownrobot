# Known Robot

**Know what works before the robot moves.**

Known Robot makes robot-policy transfer a testable claim.

We help developers using low-cost, LeRobot-compatible manipulation arms determine whether a published policy can run on their hardware—and understand why when it cannot.

## robot-skill validator

The Phase 2 public utility inspects a local robot-policy repository, creates a portable `robot-skill.yaml`, and reports the evidence required for another team to reproduce it. It detects common LeRobot and robotics metadata conventions without uploading source code or artifacts.

```bash
pipx install .
robot-skill check ./policy
```

Version 1.2.0 writes a draft to `./policy/robot-skill.yaml`, never silently
rewriting an existing manifest. Use `--force` for deliberate atomic replacement.
For CI, use `robot-skill check . --strict --no-write --format json`.
`robot-skill validate robot-skill.yaml` applies the same metadata requirements;
`--level structural` checks structure and semantic correctness without requiring
complete metadata. Invalid dates, impossible trial counts, nonfinite numbers,
and invalid shapes fail even in structural mode.

Exit `0` means the requested validation passed (default check may produce an
incomplete draft), `1` means an input/output or parsing error, and `2` means
invalid evidence, incomplete strict/complete validation, or a mismatched/unknown
target. `--output -` emits only YAML on stdout; diagnostics go to stderr.

Compare declared hardware, calibration, frequency, feature semantics, and pinned
environment requirements with `robot-skill check ./policy --target ./target.yaml
--no-write --format json`. A configuration match does not prove safe physical
transfer or independent reproduction. See the [complete CLI and migration
guide](docs/validator.md).

The 1.0 evidence contract covers policy framework and version; robot, gripper, and sensors; control frequency; observation and action shapes; dataset schema; dependencies; source revision; known compatibility; and evaluation evidence. Optional source-linked attribution credits authors without conflating publishers, evaluators and reviewers.

The [distribution runbook](docs/distribution.md) covers evidence-linked badges, portable citations/credits, the reusable root GitHub Action, correction/dispute appeals and explicitly confirmed adapter ownership. These features are implemented locally; publish the tested revision before expecting remote consumers to use them.

See the [public validator guide](https://knownrobot.com/validator), [JSON Schema](embodied-registry/schema/robot-skill.schema.json), and [complete example](embodied-registry/schema/example.robot-skill.json).

The inspector reads only the supplied directory. It never executes policy code, imports the target repository, contacts a registry, or sends telemetry. Python 3.10–3.12 is supported on Linux, macOS, and Windows.

## Measured local evaluation

Version 1.4.0 adds a non-executing, provenance-bound Hugging Face assessment workflow:

```bash
robot-skill assess-hf aadarshram/act_pusht \
  --revision 6d403b142934aaef61fc07f5eec1515c4325751f \
  --output assessments/aadarshram-act-pusht
robot-skill verify-assessment assessments/aadarshram-act-pusht
```

It downloads only allowlisted metadata, pins the full model commit in the manifest,
retains file hashes and source bytes, and produces a publication-ready assessment
record. It never downloads weights or executes policy code. See
[`docs/validator.md`](docs/validator.md) for bundle and catalog publication details.

Version 1.3.0 added a separate, explicitly enabled simulation runner:

```sh
python -m pip install '.[evaluation]'
robot-skill evaluate evaluation.yaml --allow-execution --output evidence/run-01
robot-skill verify-evaluation evidence/run-01
```

It executes actual policies in Fetch pick-and-place or reach simulations, records
every seeded attempt and failure, measures inference latency, and exports portable
evidence and eligible registry submissions. NumPy MLP archives are non-pickled;
Python policy factories additionally require `--trust-policy` and a reviewed,
isolated local environment. No physical robot or hosted execution is provided.
Simulation success is not SO-101 compatibility, physical safety, or independent
verification. See the [evaluation guide](docs/evaluation.md) for configuration,
execution boundaries, protocols, evidence integrity and publication.

## Reproduction Sprints

KnownRobot will run a multi-hardware reproduction study when its readiness gate is met, rather than forcing a monthly cadence before a real participant network exists. Each sprint freezes one public policy revision, recruits three to five materially different configurations, publishes failures as they occur, holds a public results session, and produces a reviewed joint report.

[Sprint 01: ACT SO-101 Pick-and-Place](https://knownrobot.com/sprints) has been rescheduled after the original readiness gate was not met. Applications now close January 15, 2027; the proposed run window is January 25–February 14, with a February 25 results session and March 5 report deadline. These dates remain provisional: kickoff requires a named lead, three confirmed teams, two physical setups, independent reviewers and exact protocol/configuration consent. Check the public roster and readiness status rather than assuming the invitation means the sprint has started.

The [operating runbook](docs/sprint-operations.md) covers public commitments, named reviewer assignments, immutable evidence, corrections, calendar updates and the daily seven-gate issue workflow. Run `npm run sprint:check` from `embodied-registry` to inspect current blockers; `npm run sprint:verify` checks attributable public comment consent. No demonstration participants are substituted for missing commitments.

- [Apply to Sprint 01](https://github.com/arcofdescent1/knownrobot/issues/new?template=sprint-application.yml)
- [Submit sprint evidence](https://github.com/arcofdescent1/knownrobot/issues/new?template=sprint-evidence.yml)
- [Join the Sprint 01 discussion](https://github.com/arcofdescent1/knownrobot/discussions/2)
- [Read the operating handbook](community/sprints/README.md)
- [Read the frozen sprint brief](community/sprints/2026-10-act-so101-pick-place.md)
- [Subscribe to the event calendar](https://knownrobot.com/reproduction-sprints.ics)

## Phase 0 focus

The initial community is practitioners actively attempting to reproduce or adapt public manipulation policies on SO-100, SO-101, and closely compatible low-cost LeRobot hardware. The first measurable problem is the time and uncertainty involved in reconstructing artifact, calibration, sensing, action, runtime, and evaluation conditions.

Read the complete [project thesis](https://knownrobot.com/thesis).

## Participate in Phase 1

- [Share a policy-transfer experience](https://github.com/arcofdescent1/knownrobot/issues/new?template=problem-conversation.yml)
- [Apply as a founding design partner](https://github.com/arcofdescent1/knownrobot/issues/new?template=design-partner.yml)
- [Read and challenge the field notes](https://knownrobot.com/field-notes)
- [Join the public discussion](https://github.com/arcofdescent1/knownrobot/discussions)

The first discovery cycle consists of 25 problem conversations and five concrete design-partner commitments. Public issue forms must not contain confidential information, credentials, personal contact information, private datasets, or safety-sensitive operational details.

## Evidence policy

Direct observation, participant reports, and project inference are distinguished. Failed reproductions are evidence. “Reproduced” means an evaluator independent of the artifact owner obtained a comparable result under a declared protocol.

The database enforces self-reported submissions, explicitly appointed independent
reviewers, and append-only verification decisions. See the [verification security
contract, tests, and release runbook](embodied-registry/supabase/VERIFICATION.md).

Published evaluations have permanent evidence pages and downloadable records;
private/draft records are excluded, and examples are never substituted for empty
or unavailable data. See the [public registry release contract](embodied-registry/supabase/REGISTRY.md).

## Repository layout

- `embodied-registry/` — Next.js application deployed on Vercel
- `robot_skill/` — Python command-line validator
- `tests/` — validator contracts and representative repository layouts
- `embodied-registry/schema/` — open robot-skill 1.0 schema and complete example
- `community/sprints/` — event handbook, sprint briefs, and joint-report contract
- `embodied-registry/supabase/` — production database migration prepared for Phase 2
- `.github/ISSUE_TEMPLATE/` — Phase 1 interview and design-partner intake
