from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable

import yaml

from .model import CheckResult, Finding
from .schema import validate_manifest, IMMUTABLE_REVISION
from .dependencies import read_dependencies, pinned

MANIFEST_NAMES = ("robot-skill.yaml", "robot-skill.yml", "robot-skill.json")
CONFIG_NAMES = (
    "config.json", "policy_config.json", "train_config.json", "dataset_info.json",
    "meta/info.json", "configs/policy.json",
)
DEPENDENCY_NAMES = ("pyproject.toml", "requirements.txt", "environment.yml", "environment.yaml", "poetry.lock", "uv.lock")
FRAMEWORK_MARKERS = {
    "lerobot": ("lerobot", "policy.type", "robot.type"),
    "robomimic": ("robomimic",),
    "diffusion-policy": ("diffusion_policy", "diffusion policy"),
    "ros2": ("rclpy", "ament_python", "ros2"),
}
ARCHITECTURES = ("smolvla", "act", "diffusion", "pi0", "tdmpc", "vqbet", "sac", "td3", "ppo")


def _read_text(path: Path, limit: int = 1_000_000) -> str:
    with path.open("rb") as stream:
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise ValueError(f"Metadata file exceeds {limit} bytes: {path.name}")
    return raw.decode("utf-8")


def _nested(data: Any, paths: Iterable[str]) -> Any:
    for dotted in paths:
        value = data
        for part in dotted.split("."):
            if not isinstance(value, dict) or part not in value:
                value = None
                break
            value = value[part]
        if value is not None:
            return value
    return None


def _load_existing(path: Path, *, limit: int = 1_000_000) -> dict[str, Any]:
    class ManifestLoader(yaml.SafeLoader):
        def compose_node(self, parent, index):
            if self.check_event(yaml.events.AliasEvent):
                raise ValueError("YAML aliases are not supported; use explicit portable metadata.")
            return super().compose_node(parent, index)
    ManifestLoader.yaml_implicit_resolvers = {
        key: [(tag, expression) for tag, expression in resolvers if tag != "tag:yaml.org,2002:timestamp"]
        for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
    }
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if not isinstance(key, str):
                raise ValueError("Metadata object keys must be strings")
            if key in result:
                raise ValueError(f"Duplicate metadata key: {key}")
            result[key] = value
        return result
    def mapping(loader, node):
        loader.flatten_mapping(node)
        return unique_pairs([(loader.construct_object(key), loader.construct_object(value)) for key, value in node.value])
    ManifestLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
    try:
        data = json.loads(_read_text(path, limit), object_pairs_hook=unique_pairs) if path.suffix == ".json" else yaml.load(_read_text(path, limit), Loader=ManifestLoader)
    except (json.JSONDecodeError, yaml.YAMLError, RecursionError) as exc:
        raise ValueError(f"could not parse {path.name}: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{path.name} must contain a mapping at its root")
    try:
        json.dumps(data, allow_nan=False)
    except (ValueError, TypeError, RecursionError) as exc:
        raise ValueError(f"Metadata must be finite, acyclic JSON-compatible data: {path.name}") from exc
    return data


def _git_value(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, text=True, timeout=3, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    value = result.stdout.strip()
    return value if result.returncode == 0 and value else None


def _repository_type(url: str | None) -> str:
    if url and "huggingface.co" in url:
        return "huggingface"
    if url and "github.com" in url:
        return "github"
    return "local"


def _scan_documents(root: Path) -> tuple[str, list[str]]:
    candidates = [root / "README.md", root / "MODEL_CARD.md", root / "config.json"]
    detected = [str(path.relative_to(root)).replace("\\", "/") for path in candidates if path.is_file()]
    for path in candidates:
        if path.is_file() and not path.resolve().is_relative_to(root):
            raise ValueError(f"Metadata symlink escapes policy directory: {path.name}")
    return "\n".join(_read_text(path) for path in candidates if path.is_file()), detected


def _find_number(text: str, patterns: Iterable[str]) -> float | int | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            value = float(match.group(1))
            return int(value) if value.is_integer() else value
    return None


def _first_string(data: dict[str, Any], paths: Iterable[str]) -> str | None:
    value = _nested(data, paths)
    return str(value) if isinstance(value, (str, int, float)) else None


def _infer(root: Path) -> tuple[dict[str, Any], list[str]]:
    text, detected = _scan_documents(root)
    configs: list[dict[str, Any]] = []
    for name in CONFIG_NAMES:
        path = root / name
        if not path.is_file():
            continue
        if not path.resolve().is_relative_to(root):
            raise ValueError(f"Metadata symlink escapes policy directory: {path.name}")
        detected.append(name)
        configs.append(_load_existing(path))
    combined = "\n".join([text, *(json.dumps(item) for item in configs)]).lower()
    config: dict[str, Any] = {}
    def merge(destination, source):
        for key, value in source.items():
            if isinstance(value, dict) and isinstance(destination.get(key), dict):
                merge(destination[key], value)
            else:
                destination[key] = value
    for item in configs:
        merge(config, item)

    framework = next((name for name, markers in FRAMEWORK_MARKERS.items() if any(marker in combined for marker in markers)), None)
    architecture = _first_string(config, ("policy.type", "policy_type", "architecture", "model_type", "type"))
    if framework is None and ((_nested(config, ("policy.type",)) in ARCHITECTURES) or
      (config.get("type") in ARCHITECTURES and "input_features" in config and "output_features" in config)):
        framework = "lerobot"
    if not architecture:
        architecture = next((name for name in ARCHITECTURES if re.search(rf"\b{re.escape(name)}\b", combined)), None)
    robot = _first_string(config, ("robot.type", "robot_type", "robot", "hardware.robot_family"))
    dataset = _first_string(config, ("dataset.repo_id", "dataset_repo_id", "dataset.name", "dataset"))
    fps = _nested(config, ("fps", "dataset.fps", "control_frequency_hz", "control.frequency"))
    if not isinstance(fps, (int, float)):
        fps = _find_number(combined, (r"(?:control frequency|frequency|fps)\D{0,12}(\d+(?:\.\d+)?)\s*(?:hz|fps)",))

    dependencies, dependency_files = read_dependencies(root)
    detected.extend(dependency_files)
    remote = _git_value(root, "config", "--get", "remote.origin.url")
    revision = _git_value(root, "rev-parse", "HEAD")
    sensors: list[dict[str, Any]] = []
    declared_sensors = _nested(config, ("hardware.sensors", "robot.sensors"))
    if isinstance(declared_sensors, list):
        sensors = declared_sensors
    cameras = _nested(config, ("robot.cameras", "cameras"))
    if isinstance(cameras, dict):
        sensors.extend({"type": "rgb", "name": name} for name in cameras)
    framework_version = _first_string(config, ("framework_version", "policy.framework_version"))
    framework = _first_string(config, ("policy.framework", "framework")) or framework
    if not framework_version and framework:
        for dependency in dependencies:
            match = re.fullmatch(rf"{re.escape(framework)}==([^;\s]+)", dependency, re.IGNORECASE)
            if match:
                framework_version = match.group(1)

    manifest: dict[str, Any] = {
        "schema_version": "1.0",
        "skill": {
            "name": root.name.replace("_", " ").replace("-", " ").strip().title(),
            "version": _first_string(config, ("skill.version", "version")),
            "source": {"type": _repository_type(remote), "repository": remote, "revision": revision},
        },
        "policy": {"framework": framework, "framework_version": framework_version, "architecture": architecture},
        "hardware": {"robot_family": robot, "gripper": _first_string(config, ("hardware.gripper", "robot.gripper", "gripper")), "sensors": sensors},
        "runtime": {
            "control_frequency_hz": fps,
            "observation_shape": _nested(config, ("observation_shape", "input_shapes", "policy.input_features", "input_features")),
            "action_shape": _nested(config, ("action_shape", "output_shape", "policy.output_features", "output_features")),
            "dependencies": dependencies,
        },
        "dataset": {"repository": dataset, "revision": _first_string(config, ("dataset.revision", "dataset_revision")), "schema": _nested(config, ("dataset.features", "features", "dataset_schema"))},
        "compatibility": [],
        "evaluations": [],
    }
    return manifest, sorted(set(detected))


REQUIRED_EVIDENCE = {
    "skill.version": "Declare the policy or artifact version.",
    "skill.source.repository": "Record the GitHub, Hugging Face, OCI, or local source identifier.",
    "skill.source.revision": "Pin an immutable commit or artifact revision.",
    "policy.framework": "Declare the policy framework.",
    "policy.framework_version": "Pin the framework version.",
    "policy.architecture": "Declare the policy architecture.",
    "hardware.robot_family": "Declare the robot family used or targeted.",
    "hardware.gripper": "Declare the end effector or gripper.",
    "hardware.sensors": "Describe every required sensor and its role.",
    "runtime.control_frequency_hz": "Declare the required control frequency in hertz.",
    "runtime.observation_shape": "Declare observation names, types, and shapes.",
    "runtime.action_shape": "Declare action names, types, and shapes.",
    "runtime.dependencies": "Provide a dependency lockfile or dependency declaration.",
    "dataset.repository": "Identify the training or evaluation dataset.",
    "dataset.revision": "Pin the immutable dataset revision.",
    "dataset.schema": "Describe the dataset feature schema.",
}


def _missing(manifest: dict[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    for path, message in REQUIRED_EVIDENCE.items():
        value = _nested(manifest, (path,))
        if value is None or value == "" or value == [] or value == {}:
            findings.append(Finding("metadata.missing", message, path))
        elif isinstance(value, str) and not value.strip():
            findings.append(Finding("metadata.missing", message, path))
    for path in ("skill.source.revision", "dataset.revision"):
        revision = _nested(manifest, (path,))
        if revision and not IMMUTABLE_REVISION.fullmatch(revision):
            findings.append(Finding("metadata.unpinned", "Use a full immutable commit or SHA-256 digest, not a branch or abbreviated hash.", path))
    for path in ("runtime.observation_shape", "runtime.action_shape", "dataset.schema"):
        value = _nested(manifest, (path,))
        if value and not isinstance(value, dict):
            findings.append(Finding("metadata.ambiguous", "Use a mapping of named feature contracts.", path))
    version = manifest["policy"]["framework_version"]
    if version and not re.fullmatch(r"\d+(?:\.\d+)+(?:[a-zA-Z0-9.+-]*)", version):
        findings.append(Finding("metadata.unpinned", "Pin an exact framework version.", "policy.framework_version"))
    for index, dependency in enumerate(manifest["runtime"]["dependencies"]):
        if not pinned(dependency):
            findings.append(Finding("dependency.unpinned", "Pin an exact package version or immutable dependency artifact.", f"runtime.dependencies.{index}"))
    if not any(pinned(d) and not d.startswith("file:") for d in manifest["runtime"]["dependencies"]):
        findings.append(Finding("dependency.unresolved", "Record resolved package versions; a filename or file hash alone is not an environment lock.", "runtime.dependencies"))
    if not manifest.get("evaluations"):
        findings.append(Finding("evidence.absent", "No evaluation result is recorded; compatibility remains unverified.", "evaluations", "warning"))
    if not manifest.get("compatibility"):
        findings.append(Finding("compatibility.absent", "No known compatible or incompatible configuration is recorded.", "compatibility", "warning"))
    for index, result in enumerate(manifest.get("evaluations", [])):
        if not result.get("evidence"):
            findings.append(Finding("evidence.reference_missing", "Evaluation is a self-reported claim without an evidence reference.", f"evaluations.{index}.evidence", "warning"))
    return findings


def inspect_policy(root: Path) -> CheckResult:
    root = root.expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"policy path is not a directory: {root}")
    existing = next((root / name for name in MANIFEST_NAMES if (root / name).is_file()), None)
    if existing:
        if not existing.resolve().is_relative_to(root):
            raise ValueError(f"Manifest symlink escapes policy directory: {existing.name}")
        manifest = _load_existing(existing)
        detected = [existing.name]
    else:
        manifest, detected = _infer(root)
    findings = validate_manifest(manifest)
    if not findings:
        findings.extend(_missing(manifest))
    findings.extend(source_findings(root))
    return CheckResult(root=root, manifest=manifest, findings=findings, detected_files=detected)


def source_findings(root: Path) -> list[Finding]:
    dirty = _git_value(root, "status", "--porcelain", "--untracked-files=normal", "--", ".")
    return [Finding("source.dirty", "Working tree differs from its commit; commit policy changes before reproducing.", "skill.source.revision")] if dirty else []
