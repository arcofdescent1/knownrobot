import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from subprocess import CompletedProcess

from tools.action_runner import contained, validate
from robot_skill.schema import validate_manifest


class ActionTests(unittest.TestCase):
    def test_paths_and_symlinks_cannot_escape_workspace(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            for path in ("../outside", "bad\nname", str(root)):
                with self.assertRaises(ValueError):
                    contained(root, path)

    def test_action_uses_argv_isolation_and_preserves_failed_diagnostics(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            reports = root / "reports"
            reports.mkdir()
            output = {"status": "incomplete", "validation_levels": {"semantically_valid": True}, "manifest": {"schema_version": "1.0"}}
            with patch("tools.action_runner.subprocess.run", return_value=CompletedProcess([], 2, json.dumps(output), "")) as run:
                code, result = validate(Path("python"), root, {"path": ".", "mode": "check", "level": "complete", "manifest": "$(injection).yaml", "target": ""}, reports)
            self.assertEqual(code, 2)
            command = run.call_args.args[0]
            self.assertIn("-I", command)
            self.assertIn("--no-write", command)
            self.assertIn("--strict", command)
            self.assertNotIn("shell", run.call_args.kwargs)
            self.assertTrue((reports / "diagnostics.json").is_file())
            self.assertTrue((reports / "robot-skill.json").is_file())
            self.assertIn("does not establish", result["action"]["notice"])

    def test_invalid_modes_and_malformed_reports_fail(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp).resolve()
            options = {"path": ".", "mode": "execute", "level": "complete", "manifest": "robot-skill.yaml"}
            with self.assertRaises(ValueError):
                validate(Path("python"), root, options, root)
            options["mode"] = "validate"
            with patch("tools.action_runner.subprocess.run", return_value=CompletedProcess([], 1, "not JSON", "")):
                with self.assertRaises(ValueError):
                    validate(Path("python"), root, options, root)

    def test_attribution_extension_is_optional_and_rejects_unsafe_credit(self):
        manifest = json.loads(Path("embodied-registry/schema/example.robot-skill.json").read_text(encoding="utf-8"))
        self.assertEqual(validate_manifest(manifest), [])
        manifest["attribution"] = [{"name": "Original author", "role": "policy-author", "source_url": "https://example.org/paper"}]
        self.assertEqual(validate_manifest(manifest), [])
        manifest["attribution"][0]["source_url"] = "https://user:secret@example.org/paper"
        self.assertTrue(validate_manifest(manifest))
