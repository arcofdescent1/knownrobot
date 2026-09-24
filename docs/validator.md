# robot-skill metadata validation and external assessment

Release 1.4.0 adds a provenance-bound Hugging Face assessment workflow. Release
1.3.0 also provides a separate [measured simulation runner](evaluation.md).
The execution boundaries below still apply to `check` and `validate`; execution
requires the distinct `evaluate --allow-execution` command.

This release fixes validator correctness and adds conservative target comparison.
The manifest schema remains 1.0; the packaged and public schema are identical and
checked by CI. Existing drafts remain readable, but abbreviated revisions and
dependency filenames no longer count as complete reproducibility metadata.

## Install and inspect

From a checkout of this release, `pipx install .` installs the `robot-skill` command
in an isolated environment. Distributors can build with `python -m pip wheel .
--no-deps` and install the resulting `knownrobot-1.4.0-py3-none-any.whl`. Python
3.10–3.12 is supported; CI runs the suite and installed-wheel smoke test across
Linux, macOS, and Windows.

```bash
robot-skill check ./policy
robot-skill check ./policy --strict --no-write --format json
robot-skill validate ./policy/robot-skill.yaml
robot-skill validate ./policy/robot-skill.yaml --level structural
robot-skill check ./policy --output - --format json
```

## Non-executing Hugging Face assessment

`assess-hf` turns one immutable model revision into a reviewable bundle without
downloading checkpoint weights or executing policy code:

```bash
robot-skill assess-hf aadarshram/act_pusht \
  --revision 6d403b142934aaef61fc07f5eec1515c4325751f \
  --output assessments/aadarshram-act-pusht
robot-skill verify-assessment assessments/aadarshram-act-pusht
```

Omit `--revision` only when intentionally assessing the repository's current
HEAD. The command resolves it through the Hugging Face model API and records the
returned full commit; a branch name or abbreviated SHA is never accepted as a
pin. Supplying a revision verifies that the API resolves exactly that commit.

The output directory must not exist. It contains:

- `assessment.json`: the publication-ready external assessment record;
- `manifest.json`: the generated portable manifest with verified Hugging Face
  repository and commit provenance;
- `checksums.json`: SHA-256 bindings for the canonical manifest and source-file
  inventory; and
- `source/`: the exact allowlisted metadata bytes used by the inspector.

`verify-assessment` recomputes every binding, checks the retained metadata bytes,
and confirms that the assessment, manifest, inventory and source revision agree.
Integrity checking does not establish correctness, compatibility, evaluation or
independent reproduction.

For repository administrators, `--catalog
embodied-registry/src/data/external-policy-assessments.json` appends the validated
record to the data-driven public catalog. The catalog automatically supplies the
listing, detail page, JSON downloads and sitemap URL. Existing slugs and existing
provider/repository/revision identities are rejected; the catalog is written
atomically. A normal reviewed code release is still required to publish the
source-controlled catalog.

Network access is restricted to `https://huggingface.co`. The fixed allowlist is
limited to model cards, policy/training/dataset configuration, pre/postprocessor
configuration and dependency declarations or locks. Each file is limited to 1 MB
and the combined snapshot to 8 MB. Safetensors, pickle files, Python policy code,
media and arbitrary sibling paths are never requested.

The default output belongs to the supplied policy directory. Existing manifests
are inspected in place, preserving comments and formatting. Explicit output paths
are relative to the caller's current directory; overwriting requires `--force`.
Writes are atomic and flush before publication. Without `--force`, concurrent
writers cannot replace an existing file. The destination filesystem must support
hard links for atomic create-if-absent; unsupported filesystems fail explicitly
without overwriting data. `--force` uses atomic replacement.

With `--output -`, stdout is exclusively YAML and diagnostics (including JSON)
are exclusively stderr. `--no-write --format json` produces one JSON diagnostic
document on stdout. No invalid manifest is written.

## Validation levels

- `structurally_valid`: JSON Schema 1.0, including calendar-date formats.
- `semantically_valid`: structural validity plus successes <= trials, finite
  numbers, valid feature dimensions, and consistent dependency pins.
- `metadata_complete`: required artifact, framework, hardware, runtime, dataset,
  and dependency metadata are present and pinned. This does not require successful
  robot trials. Missing evaluations/evidence remain explicitly reported warnings.
- `configuration_compatible`: `not_checked`, `match`, `mismatch`, or `unknown`,
  from comparison of declared configuration only.
- `independently_reproduced`: always `not_established_by_local_validation`.
  A manifest's evaluation or compatibility entry is a contributor claim, not an
  authenticated reviewer decision. Registry verification uses the separate review API.

Default `check` allows a semantically valid incomplete draft (exit 0). Invalid
structure or semantics always exits 2. `check --strict` and default `validate`
exit 2 for incomplete metadata. `validate --level publishable` enforces the shared registry publication contract, including immutable dataset provenance, named feature mappings and a resolved dependency environment. Conditional requirements must be resolved for the actual target environment before publication. An explicitly empty sensor array is valid for state-only simulation. Publication completeness is not independent verification or a safety certification. `validate --level structural` intentionally allows
incomplete metadata while still rejecting impossible results. Input, parsing, and
output errors exit 1. Supplying `--target` exits 2 for mismatches or unknowns.

## Pinned metadata and safe detection

Use full 40/64-character commit IDs or SHA-256 digests, not `main`, `latest`, or
abbreviated hashes. Pin the dataset revision and exact framework version too.
Runtime dependencies record exact requirements such as `lerobot==0.4.0`, immutable
direct references, and `file:uv.lock#sha256:...` fingerprints. File fingerprints
alone do not establish a resolved environment.

The inspector reads requirements (including in-directory `-r`/`-c` includes),
PEP 621/Poetry project declarations, uv/Poetry locks, and Conda environment files.
Resolved lock pins supersede compatible version ranges. Conflicting pins/ranges
fail; unresolved ranges remain errors in complete validation. Optional dependency
groups, platform-specific resolution, transitive package hashes, and accelerator
driver compatibility are not automatically established: supply the actual resolved
deployment environment and immutable lock artifacts. The tool never installs
dependencies or executes requirements-file options.

LeRobot checkpoint `type`, root/nested feature maps, declared robot/cameras,
dataset metadata, and exact framework dependencies are inspected. Undeclared
grippers, calibrations, hardware, dataset revisions, and evaluations are not guessed.
Files larger than 1 MB, malformed metadata, duplicate keys, YAML aliases,
non-string object keys, and nonfinite values fail clearly. Dependency includes and
metadata symlinks may not escape the supplied directory. The inspector runs only
read-only Git metadata commands; uncommitted policy changes fail strict validation.
It never imports policy code, uploads artifacts, sends telemetry, or contacts a Hub.

## Target configuration

`--target` accepts YAML or JSON containing `schema_version: "1.0"`, `hardware`,
`runtime`, and `policy` with the same field definitions as the manifest. It represents
the environment you intend to run, not another claim of independent reproduction.

```yaml
schema_version: '1.0'
policy:
  framework: lerobot
  framework_version: 0.4.0
  architecture: act
hardware:
  robot_family: SO-101
  gripper: standard-gripper
  sensors:
    - type: rgb
      name: wrist
      calibration: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
runtime:
  control_frequency_hz: 30
  observation_shape:
    observation.state:
      shape: [6]
      dtype: float32
      semantics:
        units: radians
        joint_order: [joint1, joint2, joint3, joint4, joint5, gripper]
        normalization: none
        frame: joint
  action_shape:
    action:
      shape: [6]
      dtype: float32
      semantics:
        units: radians
        joint_order: [joint1, joint2, joint3, joint4, joint5, gripper]
        normalization: none
        frame: joint
  dependencies: [lerobot==0.4.0]
```

This is an illustrative contract, not a validated SO-101 operational configuration.
Replace it with your real calibration, units, joint order, normalization, sensor
features, and complete environment. Every required policy observation must appear
with identical declared shape, dtype, and semantics; dimensions alone yield unknown.
Required sensor roles/calibrations must match; extra target sensors are permitted.
SO-101 spelling variants normalize, but SO-100 is not silently treated as SO-101.
Dependencies, rate, framework/version, and architecture compare conservatively.
Adapters are not executed or inferred. A mismatch/unknown must be resolved or
documented before proceeding; a match is not physical safety certification.

## Release verification

Run `python -m unittest discover -s tests -v`. The suite covers actual immutable
ACT and SmolVLA metadata extracts, malformed inputs, impossible evaluations,
overwrite safety, output streams, pins, semantic mismatches, and unknowns.
Those fixtures do not count as physical trials or the ten-real-policy adoption goal.
Build/install the wheel in a clean environment and run the installed command from
outside the checkout. CI enforces the same clean-install check.
