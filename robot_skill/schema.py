from __future__ import annotations

import json
import math
import re
from importlib.resources import files
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from .model import Finding


def load_schema() -> dict[str, Any]:
    resource = files("robot_skill").joinpath("robot-skill.schema.json")
    return json.loads(resource.read_text(encoding="utf-8"))


def validate_manifest(manifest: dict[str, Any]) -> list[Finding]:
    validator = Draft202012Validator(load_schema(), format_checker=FormatChecker())
    findings: list[Finding] = []
    for error in sorted(validator.iter_errors(manifest), key=lambda item: tuple(str(p) for p in item.absolute_path)):
        location = ".".join(str(part) for part in error.absolute_path) or "$"
        findings.append(Finding("schema.invalid", error.message, location))
    if findings:
        return findings
    def finite(value: Any, path: str) -> None:
        if isinstance(value, float) and not math.isfinite(value):
            findings.append(Finding("semantic.invalid", "Numbers must be finite.", path))
        elif isinstance(value, dict):
            for key, child in value.items(): finite(child, f"{path}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value): finite(child, f"{path}.{index}")
    finite(manifest, "$")
    for index, result in enumerate(manifest["evaluations"]):
        if result["successes"] > result["trials"]:
            findings.append(Finding("evaluation.invalid_counts", "Successes cannot exceed trials.", f"evaluations.{index}.successes"))
    for field in ("observation_shape", "action_shape"):
        shapes = manifest["runtime"][field]
        if shapes is None:
            continue
        entries = shapes.values() if isinstance(shapes, dict) else [shapes]
        for shape in entries:
            dimensions = shape.get("shape") if isinstance(shape, dict) else shape
            if not isinstance(dimensions, list) or not dimensions or any(type(d) is not int or d < 1 for d in dimensions):
                findings.append(Finding("runtime.invalid_shape", "Feature shapes must contain positive integer dimensions.", f"runtime.{field}"))
                break
    dataset = manifest["dataset"]["schema"]
    if isinstance(dataset, dict):
        for key, feature in dataset.items():
            if isinstance(feature, dict):
                dimensions = feature.get("shape")
                if dimensions is not None and (not isinstance(dimensions, list) or any(type(d) is not int or d < 1 for d in dimensions)):
                    findings.append(Finding("semantic.invalid", "Dataset shapes must contain positive integer dimensions.", f"dataset.schema.{key}"))
            elif not isinstance(feature, (str, list)):
                findings.append(Finding("semantic.invalid", "Dataset features must declare a dtype/shape or named feature descriptor.", f"dataset.schema.{key}"))
    from packaging.requirements import Requirement, InvalidRequirement
    from packaging.utils import canonicalize_name
    versions = {}
    for dependency in manifest["runtime"]["dependencies"]:
        try:
            parsed = Requirement(dependency)
        except InvalidRequirement:
            continue
        specs = list(parsed.specifier)
        if len(specs) == 1 and specs[0].operator == "==" and "*" not in specs[0].version:
            key = (canonicalize_name(parsed.name), str(parsed.marker))
            if key in versions and versions[key] != specs[0].version:
                findings.append(Finding("semantic.invalid", "Conflicting versions for the same dependency and marker.", "runtime.dependencies"))
            versions[key] = specs[0].version
    return findings


IMMUTABLE_REVISION = re.compile(r"^(?:sha256:)?(?:[a-f0-9]{40}|[a-f0-9]{64})$")
