# Local measured simulation evaluation — robot-skill 1.3.0

`check` and `validate` inspect metadata. `evaluate` separately executes actual
policy inference and simulator steps on the evaluator's computer. No robot
hardware, network upload, checkpoint download or dependency installation is
performed by the runner. It is not a hosted execution service or safety certifier.

## Install

Use Python 3.10–3.12 in a dedicated environment:

```sh
python -m pip install '.[evaluation]'
robot-skill evaluate --help
```

The evaluated stack pins Gymnasium 1.2.3, Gymnasium Robotics 1.4.2, MuJoCo 3.6.0
and NumPy 2.2.6. Linux is the release CI platform for simulator tests; the actual
headless Windows Python 3.12 regression also runs locally. Farama officially
supports Linux/macOS, not Windows. Package versions, Python/OS, input digests,
observed feature shapes and simulator timestep accompany the results.

Supported environments are `FetchPickAndPlace-v4` and `FetchReach-v4`.
These simulate a Fetch arm, not an SO-100/SO-101 arm. Never relabel their results
as evidence that a LeRobot manipulation checkpoint transfers to physical hardware.
See the [upstream protocol](https://robotics.farama.org/main/envs/fetch/pick_and_place/).

## Prepare the actual policy and manifest

Use your actual source repository and full 40/64-character Git revision in a
structurally valid `robot-skill.yaml`. Declare `hardware.robot_family: Fetch` and
accurate policy/framework metadata, observation/action features, dependencies,
dataset provenance and licensing. Missing metadata is not synthesized as fact.
The source revision is a contributor declaration; local artifact hashes identify
the bytes actually loaded, not authentication of a remote repository association.

Two policy formats are supported:

1. `numpy_mlp`: a NumPy `.npz` file containing consecutive `weight_0`, `bias_0`,
   `weight_1`, `bias_1`, etc. Each weight has shape `[input, output]`; each bias
   has shape `[output]`. Input concatenates `observation` then `desired_goal`.
   Every layer applies tanh, with the final output scaled to action-space bounds.
   Pick-and-place input is 28 values; reach input is 13; output is four actions.
   Arrays must be finite, compatible and non-pickled. At most 32 layers and
   256 MiB decompressed are accepted. This is an explicit model format, not a
   conversion of arbitrary LeRobot or PyTorch checkpoints.
2. `python`: your reviewed local Python file defines
   `make_policy(observation_space, action_space, seed)` and returns a callable
   accepting the Gymnasium observation dictionary and returning one action.
   Each trial constructs a new policy, so stateful policies start fresh. The
   factory may load your real framework/checkpoint using its native API and
   preprocessing. Install and pin that framework yourself, keep all loaded
   artifacts on immutable source revisions, and publish their hashes beside the
   bundle. The runner hashes the factory itself; it cannot authenticate arbitrary
   additional files or network activity performed by that factory.

Python policies require `--trust-policy`. They execute arbitrary local code and
can access files, credentials, networks and attached devices. Review the complete
code and use a dedicated container/VM without credentials or attached robot
hardware. Process timeouts are lifecycle controls, **not a security sandbox**.
The runner itself exposes no physical robot interface.

## Evaluation configuration

Create a YAML/JSON file next to the actual policy and manifest. Required fields:

| Field | Meaning |
| --- | --- |
| `format` | `knownrobot-evaluation/1.0` |
| `environment` | One of the two supported environment IDs |
| `trials` | 1–1000 planned attempts, declared before execution |
| `seed` | First uint32 seed; each attempt uses seed + zero-based index |
| `max_steps` | 1–10000 simulator steps per attempt |
| `trial_timeout_seconds` | 1–3600 wall-clock seconds, including worker setup |
| `manifest` | Relative path to your actual manifest |
| `policy` | Exactly `kind`, relative `path`, and lowercase file `sha256` |

Artifact symlinks must stay within the configuration directory. Unknown fields,
incorrect hashes and invalid manifests fail before creating a bundle or running
the simulator. Obtain the real artifact digest using your system SHA-256 utility;
do not substitute a sample digest or a branch name.

```sh
robot-skill evaluate evaluation.yaml --allow-execution --output evidence/run-01
robot-skill evaluate evaluation.yaml --allow-execution --trust-policy --output evidence/run-02
robot-skill verify-evaluation evidence/run-01
```

Choose a new output directory for each cohort. Existing directories are never
overwritten. `check`/`validate` never call this runner or import the policy.

## Counted outcomes and evidence

One fresh process and seeded environment reset per planned attempt prevents
policy state from crossing trials. Every reset, observation, selected action,
reward, termination/truncation and simulator success signal is recorded. Success
is the **final** `info.is_success`, not success at any earlier point or a fabricated
percentage. Episodes run to the declared step limit or environment termination.
The upstream success predicate means reaching the simulator's desired goal; it
does not establish a tabletop release/placement protocol or physical safety.

Actions outside the environment bounds, wrong dimensions or nonfinite values
fail rather than silently clip. Inference/step errors after a successful reset
count as failed trials. Setup/reset failures and timeouts are preserved explicitly;
no attempts are omitted. A setup failure prevents a submission export rather
than promoting a partial cohort's percentage. Successful simulation execution
may legitimately have 0% success.

The bundle contains:

- `result.json`: complete trial ledger, config/manifest, counts, protocol,
  provenance, package versions, platform and per-trial inference latency.
- `trial-NNNN.json` and `trace-NNNN.jsonl`: every attempt and its observed steps.
- `checksums.json`: SHA-256 inventory of all portable bundle files.
- `submission.json`, when requested and eligible: an attributable registry input.

`verify-evaluation` checks hashes, trial totals and trace-derived final outcomes.
It does not authenticate the evaluator: someone controlling the files can rewrite
the inventory too. Independent review remains necessary. No local command grants
`runner_verified`, `reproduced`, `lab_verified` or `certified` status.

## Publish through your existing repository

Select an HTTPS evidence location in your existing repository, run with
`--evidence-url` pointing to that location, publish the complete bundle at an
immutable revision, and check that the location actually resolves. The runner
neither uploads it nor checks a user-provided URL's availability.

Review the generated `submission.json`, actual license, attribution and source
revision, then submit it through KnownRobot's authenticated evidence form.
The payload declares simulation explicitly and starts as self-reported. Graph
connections do not pool different protocols or hardware configurations. Oversized
exports are withheld with an explicit reason; the full measured bundle is retained.
Predeclare a smaller cohort instead of deleting failed trials to fit an export.

Exit 0 means execution completed without infrastructure/policy errors, not that
the policy succeeded. Exit 2 preserves error/blocked evidence. Exit 1 means an
input, permission, dependency, integrity or filesystem failure.

## Release checks

Run the full Python suite with the evaluation extra installed and
`KNOWNROBOT_REQUIRE_SIM_TESTS=1`. Real MuJoCo tests exercise successful Fetch reach
control, repeatable seeded traces, failed pick-and-place inference, invalid
actions, integrity rejection and exports. The feedback controller in the test
fixtures is regression tooling, not a trained public policy or adoption evidence.
Build and install the wheel outside the checkout and verify both CLI commands.
