"""Durable, non-executing validator assessment reports."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from . import __version__
from .model import CheckResult

MAX_HASH_BYTES = 5_000_000
MAX_HASH_TOTAL_BYTES = 25_000_000


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _inventory(result: CheckResult) -> list[dict[str, Any]]:
    inventory: list[dict[str, Any]] = []
    total = 0
    root = result.root.resolve()
    for relative in sorted(set(result.detected_files)):
        path = (root / relative).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"Inspected metadata is missing or escapes the policy directory: {relative}")
        size = path.stat().st_size
        if size > MAX_HASH_BYTES:
            raise ValueError(f"Inspected metadata exceeds the {MAX_HASH_BYTES}-byte report limit: {relative}")
        total += size
        if total > MAX_HASH_TOTAL_BYTES:
            raise ValueError(f"Inspected metadata exceeds the {MAX_HASH_TOTAL_BYTES}-byte aggregate report limit.")
        payload = path.read_bytes()
        inventory.append({"path": relative.replace("\\", "/"), "sha256": sha256(payload), "bytes": len(payload)})
    return inventory


def _fact(manifest: dict[str, Any], path: str) -> dict[str, Any] | None:
    value: Any = manifest
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    if value is None or value == "" or value == [] or value == {}:
        return None
    return {"path": path, "value": value}


def detected_facts(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    paths = (
        "policy.framework", "policy.framework_version", "policy.architecture",
        "hardware.robot_family", "hardware.gripper", "hardware.sensors",
        "runtime.control_frequency_hz", "runtime.observation_shape", "runtime.action_shape",
        "runtime.dependencies", "dataset.repository", "dataset.revision", "dataset.schema",
    )
    return [item for path in paths if (item := _fact(manifest, path)) is not None]


def create_validation_report(result: CheckResult, *, now: Callable[[], datetime] | None = None) -> dict[str, Any]:
    inventory = _inventory(result)
    manifest_hash = sha256(canonical_json(result.manifest))
    inventory_hash = sha256(canonical_json(inventory))
    timestamp = (now or (lambda: datetime.now(timezone.utc)))().astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    existing_manifest = any(name in {"robot-skill.yaml", "robot-skill.yml", "robot-skill.json"} for name in result.detected_files)
    report = {
        "record_type": "validator_assessment_report",
        "format": "knownrobot-validator-assessment/1.0",
        "created_at": timestamp,
        "validator_version": __version__,
        "status": "complete" if result.complete else "incomplete",
        "execution_boundary": {
            "method": "metadata_only", "executed_policy_code": False, "evaluated_policy": False,
            "established_compatibility": False,
            "notice": "Metadata inspection does not establish policy performance, physical transfer, safety or independent reproduction.",
        },
        "provenance": result.manifest.get("skill", {}).get("source"),
        "manifest": result.manifest,
        "findings": {
            "errors": [item.as_dict() for item in result.errors],
            "warnings": [item.as_dict() for item in result.warnings],
        },
        "validation_levels": result.as_dict()["validation_levels"],
        "target_comparison": result.target_comparison,
        "inspected_files": inventory,
        "evidence_classes": {
            "validator_detected_facts": [] if existing_manifest else detected_facts(result.manifest),
            "portable_manifest_declarations": detected_facts(result.manifest) if existing_manifest else [],
            "upstream_attributed_claims": [],
            "knownrobot_measured_results": [],
        },
    }
    report["binding"] = {"algorithm": "sha256", "manifest_sha256": manifest_hash,
                         "inventory_sha256": inventory_hash, "report_payload_sha256": sha256(canonical_json(report))}
    return report


def verify_validation_report(report_path: Path, policy_root: Path) -> dict[str, Any]:
    try:
        report = json.loads(report_path.expanduser().resolve().read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not parse validator assessment report: {exc}") from exc
    if not isinstance(report, dict) or report.get("record_type") != "validator_assessment_report" or report.get("format") != "knownrobot-validator-assessment/1.0":
        raise ValueError("Unsupported validator assessment report.")
    binding = report.get("binding")
    if not isinstance(binding, dict) or binding.get("algorithm") != "sha256":
        raise ValueError("Validator assessment report has no supported integrity binding.")
    payload = dict(report)
    payload.pop("binding", None)
    if sha256(canonical_json(payload)) != binding.get("report_payload_sha256"):
        raise ValueError("Validator assessment report payload checksum mismatch.")
    manifest = report.get("manifest")
    inventory = report.get("inspected_files")
    if not isinstance(manifest, dict) or sha256(canonical_json(manifest)) != binding.get("manifest_sha256"):
        raise ValueError("Validator assessment manifest checksum mismatch.")
    if not isinstance(inventory, list) or sha256(canonical_json(inventory)) != binding.get("inventory_sha256"):
        raise ValueError("Validator assessment inventory checksum mismatch.")
    root = policy_root.expanduser().resolve()
    if not root.is_dir():
        raise ValueError(f"Policy directory does not exist: {root}")
    for item in inventory:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise ValueError("Invalid validator assessment inventory entry.")
        path = (root / item["path"]).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError(f"Missing inspected metadata: {item['path']}")
        data = path.read_bytes()
        if len(data) != item.get("bytes") or sha256(data) != item.get("sha256"):
            raise ValueError(f"Inspected metadata checksum mismatch: {item['path']}")
    return {"status": "integrity_checked", "record_type": report["record_type"],
            "files": len(inventory), "report_payload_sha256": binding["report_payload_sha256"]}
