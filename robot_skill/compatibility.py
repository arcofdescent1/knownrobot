"""Conservative comparison of declared contracts, never physical verification."""
from __future__ import annotations

from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from .model import Finding
from .schema import load_schema


def compare_target(manifest: dict[str, Any], target: dict[str, Any]) -> tuple[dict[str, Any], list[Finding]]:
    schema = load_schema()
    target_schema = {
        "type": "object", "additionalProperties": False,
        "required": ["schema_version", "hardware", "runtime", "policy"],
        "properties": {name: schema["properties"][name] for name in ("schema_version", "hardware", "runtime", "policy")},
    }
    invalid = list(Draft202012Validator(target_schema, format_checker=FormatChecker()).iter_errors(target))
    if invalid:
        raise ValueError("Invalid target profile: " + "; ".join(error.message for error in invalid))
    sensor_names = [s.get("name") for s in target["hardware"]["sensors"] if s.get("name")]
    if len(sensor_names) != len(set(sensor_names)):
        raise ValueError("Target sensor names must be unique")
    checks = []
    findings = []
    paths = ("hardware.robot_family", "hardware.gripper", "hardware.sensors",
             "runtime.control_frequency_hz", "runtime.observation_shape", "runtime.action_shape",
             "policy.framework", "policy.framework_version", "policy.architecture")
    def missing(value):
        if value is None or value == "" or value == [] or value == {}:
            return True
        if isinstance(value, dict):
            return any(missing(v) for v in value.values())
        if isinstance(value, list):
            return any(missing(v) for v in value)
        return False
    for path in paths:
        section, field = path.split(".")
        required = manifest[section][field]
        provided = target[section][field]
        if missing(required) or missing(provided):
            status = "unknown"
        else:
            left, right = required, provided
            if path == "hardware.robot_family":
                left, right = (str(v).lower().replace("-", "").replace("_", "") for v in (left, right))
            if path == "hardware.sensors":
                # Compare required sensor roles; additional target sensors are harmless.
                if any(not sensor.get("name") or not sensor.get("calibration") for sensor in required + provided):
                    status = "unknown"
                else:
                    status = "match" if all(sensor in provided for sensor in required) else "mismatch"
            else:
                status = "match" if left == right else "mismatch"
                if field in ("observation_shape", "action_shape") and status == "match":
                    # Equal dimensions alone do not establish equal units/order/normalization.
                    features = required.values() if isinstance(required, dict) else [required]
                    if any(not isinstance(f, dict) or not f.get("dtype") or not isinstance(f.get("semantics"), dict) or missing(f.get("semantics")) for f in features):
                        status = "unknown"
        checks.append({"path": path, "status": status, "required": required, "provided": provided})
        if status != "match":
            findings.append(Finding(f"target.{status}", "Declared target contract differs." if status == "mismatch" else "Insufficient metadata to compare this contract.", path))
    required_dependencies = {d for d in manifest["runtime"]["dependencies"] if not d.startswith("file:")}
    provided_dependencies = set(target["runtime"]["dependencies"])
    status = "unknown" if not required_dependencies else "match" if required_dependencies <= provided_dependencies else "mismatch"
    checks.append({"path": "runtime.dependencies", "status": status,
                   "required": sorted(required_dependencies), "provided": sorted(provided_dependencies)})
    if status != "match":
        findings.append(Finding(f"target.{status}", "Target must declare the same resolved dependency requirements.", "runtime.dependencies"))
    status = "mismatch" if any(c["status"] == "mismatch" for c in checks) else "unknown" if any(c["status"] == "unknown" for c in checks) else "match"
    return {"status": status, "scope": "declared_configuration_only", "checks": checks,
            "physical_transfer_verified": False}, findings
