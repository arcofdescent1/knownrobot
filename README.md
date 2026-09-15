# Known Robot

**Know what works before the robot moves.**

Known Robot makes robot-policy transfer a testable claim.

We help developers using low-cost, LeRobot-compatible manipulation arms determine whether a published policy can run on their hardware—and understand why when it cannot.

## robot-skill validator

The Phase 2 public utility inspects a local robot-policy repository, creates a portable `robot-skill.yaml`, and reports the evidence required for another team to reproduce it. It detects common LeRobot and robotics metadata conventions without uploading source code or artifacts.

```bash
pipx install git+https://github.com/arcofdescent1/knownrobot.git@v1.1.0
robot-skill check ./policy
```

The default check writes an incomplete draft so it can be improved and reviewed like code. For continuous integration, use `robot-skill check . --strict --no-write`. Exit `0` means the scan completed, exit `1` means input could not be read or parsed, and exit `2` means strict validation failed. Add `--format json` for machine-readable diagnostics, or run `robot-skill validate robot-skill.yaml` to validate an existing manifest.

The 1.0 evidence contract covers policy framework and version; robot, gripper, and sensors; control frequency; observation and action shapes; dataset schema; dependencies; source revision; known compatibility; and evaluation evidence.

See the [public validator guide](https://knownrobot.com/validator), [JSON Schema](embodied-registry/schema/robot-skill.schema.json), and [complete example](embodied-registry/schema/example.robot-skill.json).

The inspector reads only the supplied directory. It never executes policy code, imports the target repository, contacts a registry, or sends telemetry. Python 3.10–3.12 is supported on Linux, macOS, and Windows.

## Monthly Reproduction Sprints

The community runs one two-week, multi-hardware reproduction study each month. Every sprint freezes one public policy revision, recruits three to five materially different configurations, publishes failures as they occur, holds a public results session, and produces a reviewed joint report.

[Sprint 01: ACT SO-101 Pick-and-Place](https://knownrobot.com/sprints) accepts applications through September 18, 2026. The run window is September 21–October 4, the public results session is October 8, and the joint report is published October 12.

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

## Repository layout

- `embodied-registry/` — Next.js application deployed on Vercel
- `robot_skill/` — Python command-line validator
- `tests/` — validator contracts and representative repository layouts
- `embodied-registry/schema/` — open robot-skill 1.0 schema and complete example
- `community/sprints/` — event handbook, sprint briefs, and joint-report contract
- `embodied-registry/supabase/` — production database migration prepared for Phase 2
- `.github/ISSUE_TEMPLATE/` — Phase 1 interview and design-partner intake
