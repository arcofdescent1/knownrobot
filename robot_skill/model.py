from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Finding:
    code: str
    message: str
    path: str
    severity: str = "error"

    def as_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "code": self.code,
            "path": self.path,
            "message": self.message,
        }


@dataclass
class CheckResult:
    root: Path
    manifest: dict[str, Any]
    findings: list[Finding] = field(default_factory=list)
    detected_files: list[str] = field(default_factory=list)
    target_comparison: dict[str, Any] | None = None

    @property
    def valid(self) -> bool:
        return not any(f.code.startswith(("schema.", "semantic.", "evaluation.", "runtime.invalid")) for f in self.errors)

    @property
    def errors(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.severity == "error"]

    @property
    def warnings(self) -> list[Finding]:
        return [finding for finding in self.findings if finding.severity == "warning"]

    @property
    def complete(self) -> bool:
        return not self.errors

    def as_dict(self) -> dict[str, Any]:
        from .inspector import _missing
        metadata_complete = self.valid and not any(f.severity == "error" for f in _missing(self.manifest)) and not any(f.code == "source.dirty" for f in self.errors)
        return {
            "status": "complete" if self.complete else "incomplete",
            "validation_levels": {
                "structurally_valid": not any(f.code == "schema.invalid" for f in self.errors),
                "semantically_valid": self.valid,
                "metadata_complete": metadata_complete,
                "configuration_compatible": self.target_comparison["status"] if self.target_comparison else "not_checked",
                "independently_reproduced": "not_established_by_local_validation",
            },
            "target_comparison": self.target_comparison,
            "root": str(self.root),
            "summary": {"errors": len(self.errors), "warnings": len(self.warnings)},
            "findings": [finding.as_dict() for finding in self.findings],
            "detected_files": self.detected_files,
            "manifest": self.manifest,
        }
