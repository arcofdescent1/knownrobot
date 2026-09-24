from __future__ import annotations

import json
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

from robot_skill.cli import main
from robot_skill.inspector import inspect_policy
from robot_skill.report import create_validation_report, verify_validation_report


class DurableAssessmentReportTests(unittest.TestCase):
    def test_report_contains_manifest_findings_hashes_boundary_and_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config.json").write_text(json.dumps({"policy": {"type": "act"}, "dataset": {"repo_id": "lab/data"}}), encoding="utf-8")
            report = create_validation_report(inspect_policy(root), now=lambda: datetime(2026, 9, 24, 20, tzinfo=timezone.utc))
            self.assertEqual(report["record_type"], "validator_assessment_report")
            self.assertEqual(report["format"], "knownrobot-validator-assessment/1.0")
            self.assertFalse(report["execution_boundary"]["executed_policy_code"])
            self.assertFalse(report["execution_boundary"]["evaluated_policy"])
            self.assertIn("manifest", report)
            self.assertGreater(len(report["findings"]["errors"]), 0)
            self.assertEqual(report["inspected_files"][0]["path"], "config.json")
            self.assertRegex(report["inspected_files"][0]["sha256"], r"^[a-f0-9]{64}$")
            self.assertEqual(report["provenance"], {"type": "local", "repository": None, "revision": None})
            self.assertGreater(len(report["evidence_classes"]["validator_detected_facts"]), 0)
            self.assertEqual(report["evidence_classes"]["knownrobot_measured_results"], [])
            report_path = root / "report.json"
            report_path.write_text(json.dumps(report), encoding="utf-8")
            self.assertEqual(verify_validation_report(report_path, root)["status"], "integrity_checked")

    def test_cli_writes_report_atomically_and_never_relabels_it_as_evaluation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config.json").write_text('{"policy":{"type":"act"}}', encoding="utf-8")
            output = root / "assessment.json"
            with redirect_stdout(StringIO()):
                self.assertEqual(main(["check", str(root), "--format", "assessment", "--output", str(output)]), 0)
            report = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(report["record_type"], "validator_assessment_report")
            self.assertEqual(report["execution_boundary"]["method"], "metadata_only")
            with redirect_stdout(StringIO()):
                self.assertEqual(main(["verify-report", str(output), "--policy", str(root)]), 0)
            with redirect_stdout(StringIO()):
                self.assertEqual(main(["check", str(root), "--format", "assessment", "--output", str(output)]), 1)
            with redirect_stdout(StringIO()):
                self.assertEqual(main(["check", str(root), "--format", "assessment", "--output", str(output), "--force"]), 0)

    def test_assessment_format_requires_a_real_output_file(self):
        with tempfile.TemporaryDirectory() as directory, redirect_stdout(StringIO()):
            self.assertEqual(main(["check", directory, "--format", "assessment", "--no-write"]), 1)
            self.assertEqual(main(["check", directory, "--format", "assessment"]), 1)
            self.assertEqual(main(["check", directory, "--format", "assessment", "--output", "-"]), 1)


if __name__ == "__main__":
    unittest.main()
