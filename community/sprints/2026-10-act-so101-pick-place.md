# Sprint 01: ACT SO-101 Pick-and-Place

## Selected immutable artifact — protocol agreement pending

- Policy: `legalaspro/act-so101-pick-place-cube-30hz-dec7-v2`
- Source: https://huggingface.co/legalaspro/act-so101-pick-place-cube-30hz-dec7-v2
- Training dataset: `legalaspro/so101-pick-and-place-cube-lerobot-30hz`
- Architecture: Action Chunking with Transformers (ACT)
- Declared embodiment: SO-101
- Declared training rate: 30 Hz
- License: Apache-2.0

The selected Hub revision is `19b56a188f1c9ec578ddd07c058b12dd980b23ff`. Teams must use that full commit in manifests and evidence. Source: https://huggingface.co/legalaspro/act-so101-pick-place-cube-30hz-dec7-v2/tree/19b56a188f1c9ec578ddd07c058b12dd980b23ff. The executable operating record and proposed protocol are in `embodied-registry/src/data/sprint-01.json`; the public roster and readiness gate are at https://knownrobot.com/sprints. No teams or reviewers are currently confirmed.

## Task and comparison question

The task is tabletop cube pick-and-place using the source policy and the team’s declared camera, gripper, calibration, compute, and robot configuration. The sprint asks: which source assumptions must match before the policy can execute safely, and which configuration differences still permit a comparable task attempt?

This is a compatibility study, not a competition. Results from different physical setups are not combined into a single success-rate leaderboard.

## Rescheduled dates — America/Denver

- Applications reopened: September 24, 2026
- Applications close: January 15, 2027 at 17:00
- Teams announced and artifact frozen: January 22, 2027 at 17:00
- Public kickoff: January 25, 2027 at 10:00
- Independent run window: January 25–February 14, 2027
- Evidence review: February 15–21, 2027
- Public results session: February 25, 2027 at 10:00
- Joint report: March 5, 2027 at 17:00

The original September–October 2026 schedule passed without the minimum roster and was not started. No teams, trials, reviews or results are implied by this rescheduling. These replacement dates remain provisional until the readiness gate passes and the named lead confirms the start. If readiness is not met, publicly postpone and renew schedule consent. A proposed public room is https://meet.jit.si/KnownRobotSprint01; attendance and room operation are not yet confirmed. Decisions and corrections are recorded in public issues and session notes.

## Eligibility and selection

Three to five teams are selected to maximize configuration diversity. Eligible teams need an SO-101, SO-100, closely compatible low-cost arm, or a simulation environment capable of exercising the same observation and action contract. At least two selected teams must operate physical hardware. Teams commit to publish a manifest even if the attempt is blocked.

## Minimum submission

Each team submits one `robot-skill.yaml`, an immutable policy revision, its declared hardware and sensor configuration, LeRobot and dependency versions, a calibration fingerprint or method, the task and reset protocol, planned/completed/success counts, interventions, the first decisive failure, and public evidence links. The evidence issue is the canonical submission record.

## Success predicate

A successful trial begins with the cube and target region in the team’s declared reset state and ends when the robot releases the cube fully within the target region without human contact, an emergency stop, or a safety-boundary violation. Teams declare timeout and reset tolerances before their first counted trial. Protocol deviations are reported rather than silently excluded.

## Owners

- Event lead: not yet appointed or publicly confirmed
- Evidence reviewers: no independent reviewers publicly confirmed

Before kickoff, confirm three to five teams, at least two physical setups, three materially different configurations, a named lead and two independent reviewers. Every person posts a protocol/configuration-bound public consent token; see the [operating runbook](../../docs/sprint-operations.md). Independent reviewers cannot be drawn from participating teams. Missing commitments are release-visible blockers, not implied endorsements.

The policy publisher is not represented as a sponsor or verifier. Selection does not imply endorsement by Hugging Face, LeRobot, or the artifact author.
