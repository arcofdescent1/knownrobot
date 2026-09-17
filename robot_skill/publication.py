"""Portable publication completeness; rules mirrored and checked across runtimes."""
import json
import re
from importlib.resources import files
from .model import Finding
from .schema import validate_manifest


def publication_findings(manifest):
    findings = validate_manifest(manifest)
    if findings:
        return findings
    rules = json.loads(files("robot_skill").joinpath("manifest-publication.rules.json").read_text())
    def at(path):
        value = manifest
        for key in path.split("."):
            value = value.get(key) if isinstance(value, dict) else None
        return value
    for path in rules["required"]:
        value = at(path)
        if value is None or value == [] or value == {} or (isinstance(value, str) and not value.strip()):
            findings.append(Finding("publication.missing", "Supply complete publication metadata.", path))
    for path, pattern in rules["patterns"].items():
        if not isinstance(at(path), str) or not re.fullmatch(pattern, at(path)):
            findings.append(Finding("publication.unpinned", "Supply a full immutable revision or exact version.", path))
    for path in rules["mappings"]:
        if not isinstance(at(path), dict):
            findings.append(Finding("publication.ambiguous", "Supply named feature mappings.", path))
    dependencies = manifest["runtime"]["dependencies"]
    for index, dependency in enumerate(dependencies):
        if not re.fullmatch(rules["dependency_pattern"], dependency):
            findings.append(Finding("publication.unpinned", "Use an exact dependency pin or immutable artifact.", f"runtime.dependencies.{index}"))
    if not any(not dep.startswith("file:") and re.fullmatch(rules["dependency_pattern"], dep) for dep in dependencies):
        findings.append(Finding("publication.unresolved", "Supply resolved package dependencies, not only file hashes.", "runtime.dependencies"))
    return findings
