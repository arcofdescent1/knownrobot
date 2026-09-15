# Sprint 01: ACT SO-101 Pick-and-Place

## Frozen artifact

- Policy: `legalaspro/act-so101-pick-place-cube-30hz-dec7-v2`
- Source: https://huggingface.co/legalaspro/act-so101-pick-place-cube-30hz-dec7-v2
- Training dataset: `legalaspro/so101-pick-and-place-cube-lerobot-30hz`
- Architecture: Action Chunking with Transformers (ACT)
- Declared embodiment: SO-101
- Declared training rate: 30 Hz
- License: Apache-2.0

The immutable Hub revision is recorded at kickoff after the application window closes. Teams must use that frozen revision in their manifests and evidence submissions.

## Task and comparison question

The task is tabletop cube pick-and-place using the source policy and the team’s declared camera, gripper, calibration, compute, and robot configuration. The sprint asks: which source assumptions must match before the policy can execute safely, and which configuration differences still permit a comparable task attempt?

This is a compatibility study, not a competition. Results from different physical setups are not combined into a single success-rate leaderboard.

## Dates — America/Denver

- Applications open: September 8, 2026
- Applications close: September 18, 2026 at 17:00
- Teams announced and artifact frozen: September 20, 2026
- Public kickoff: September 21, 2026 at 10:00
- Independent run window: September 21–October 4, 2026
- Evidence review: October 5–7, 2026
- Public results session: October 8, 2026 at 10:00
- Joint report: October 12, 2026

Kickoff and results use the public room https://meet.jit.si/KnownRobotSprint01. The room opens ten minutes before each session. Decisions and corrections are also recorded in the public sprint discussion.

## Eligibility and selection

Three to five teams are selected to maximize configuration diversity. Eligible teams need an SO-101, SO-100, closely compatible low-cost arm, or a simulation environment capable of exercising the same observation and action contract. At least two selected teams must operate physical hardware. Teams commit to publish a manifest even if the attempt is blocked.

## Minimum submission

Each team submits one `robot-skill.yaml`, an immutable policy revision, its declared hardware and sensor configuration, LeRobot and dependency versions, a calibration fingerprint or method, the task and reset protocol, planned/completed/success counts, interventions, the first decisive failure, and public evidence links. The evidence issue is the canonical submission record.

## Success predicate

A successful trial begins with the cube and target region in the team’s declared reset state and ends when the robot releases the cube fully within the target region without human contact, an emergency stop, or a safety-boundary violation. Teams declare timeout and reset tolerances before their first counted trial. Protocol deviations are reported rather than silently excluded.

## Owners

- Event lead: Known Robot maintainers
- Evidence reviewer: Known Robot maintainers, with a second independent reviewer requested from accepted teams before kickoff

The policy publisher is not represented as a sponsor or verifier. Selection does not imply endorsement by Hugging Face, LeRobot, or the artifact author.
