from __future__ import annotations

import copy
import json
import os
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import yaml

from robot_skill.cli import main
from robot_skill.compatibility import compare_target
from robot_skill.dependencies import read_dependencies
from robot_skill.inspector import inspect_policy, _load_existing
from robot_skill.schema import validate_manifest
from tests.test_cli import COMPLETE_MANIFEST


class CorrectnessTests(unittest.TestCase):
    def invoke(self, args):
        out, err = StringIO(), StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = main(args)
        return code, out.getvalue(), err.getvalue()

    def test_impossible_counts_and_dates_rejected(self):
        for field, value in (("successes", 11), ("date", "not-a-date"), ("date", "2026-02-30"), ("trials", True)):
            with self.subTest(field=field, value=value):
                m = copy.deepcopy(COMPLETE_MANIFEST)
                m["evaluations"][0][field] = value
                self.assertTrue(validate_manifest(m))

    def test_nonfinite_and_invalid_shapes_rejected(self):
        for value in (float("nan"), float("inf")):
            m = copy.deepcopy(COMPLETE_MANIFEST)
            m["runtime"]["control_frequency_hz"] = value
            self.assertTrue(validate_manifest(m))
        for shape in ([0], [-1], [True], [1.5], "[6]", {"shape": []}):
            m = copy.deepcopy(COMPLETE_MANIFEST)
            m["runtime"]["action_shape"] = {"action": shape}
            self.assertTrue(validate_manifest(m))

    def test_validate_and_strict_check_agree_on_incomplete_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.invoke(["check", str(root)])
            manifest = root / "robot-skill.yaml"
            self.assertEqual(self.invoke(["validate", str(manifest)])[0], 2)
            self.assertEqual(self.invoke(["check", str(root), "--strict", "--no-write"])[0], 2)
            code, out, _ = self.invoke(["validate", str(manifest), "--level", "structural", "--format", "json"])
            self.assertEqual(code, 0)
            levels = json.loads(out)["validation_levels"]
            self.assertTrue(levels["structurally_valid"])
            self.assertFalse(levels["metadata_complete"])
            self.assertEqual(levels["independently_reproduced"], "not_established_by_local_validation")

    def test_default_output_belongs_to_target_and_does_not_rewrite_input(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "policy"
            root.mkdir()
            self.assertEqual(self.invoke(["check", str(root)])[0], 0)
            manifest = root / "robot-skill.yaml"
            original = manifest.read_bytes()
            manifest.write_bytes(b"# preserve this comment\n" + original)
            self.assertEqual(self.invoke(["check", str(root)])[0], 0)
            self.assertTrue(manifest.read_bytes().startswith(b"# preserve"))

    def test_stdout_is_only_yaml_and_json_diagnostics_are_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            code, out, err = self.invoke(["check", directory, "-o", "-", "--format", "json"])
            self.assertEqual(code, 0)
            self.assertEqual(yaml.safe_load(out)["schema_version"], "1.0")
            self.assertIn("findings", json.loads(err))

    def test_invalid_manifest_fails_even_without_strict_and_is_not_written(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            m = copy.deepcopy(COMPLETE_MANIFEST)
            m["evaluations"][0]["successes"] = 100
            (root / "robot-skill.json").write_text(json.dumps(m))
            self.assertEqual(self.invoke(["check", directory])[0], 2)
            self.assertFalse((root / "robot-skill.yaml").exists())

    def test_overwrite_requires_force_and_atomic_failure_preserves_data(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "out.yaml"
            output.write_text("important")
            args = ["check", directory, "-o", str(output)]
            self.assertEqual(self.invoke(args)[0], 1)
            self.assertEqual(output.read_text(), "important")
            with patch("robot_skill.cli.os.replace", side_effect=OSError("disk failure")):
                self.assertEqual(self.invoke(args + ["--force"])[0], 1)
            self.assertEqual(output.read_text(), "important")
            self.assertEqual(list(Path(directory).glob(".robot-skill-*")), [])
            self.assertEqual(self.invoke(args + ["--force"])[0], 0)
            self.assertEqual(yaml.safe_load(output.read_text())["schema_version"], "1.0")

    def test_unquoted_yaml_date_remains_a_string(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.yaml"
            path.write_text(yaml.safe_dump(COMPLETE_MANIFEST).replace("'2026-08-14'", "2026-08-14"))
            self.assertEqual(self.invoke(["validate", str(path), "--format", "json"])[0], 0)

    def test_corrupt_duplicate_alias_and_nonfinite_inputs_fail_cleanly(self):
        for name, text in (("config.json", "{"), ("config.json", '{"type":"act","type":"sac"}'),
                           ("robot-skill.yaml", "a: &a [*a]"), ("config.json", '{"fps":NaN}')):
            with self.subTest(text=text), tempfile.TemporaryDirectory() as directory:
                (Path(directory) / name).write_text(text)
                code, out, _ = self.invoke(["check", directory, "--format", "json"])
                self.assertEqual(code, 1)
                self.assertEqual(json.loads(out)["status"], "error")

    def test_real_lerobot_metadata_detects_architecture_and_features(self):
        for name, architecture in (("lerobot-act", "act"), ("lerobot-smolvla", "smolvla")):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                config = json.loads((Path(__file__).parent / "fixtures" / f"{name}.json").read_text())
                (root / "config.json").write_text(json.dumps(config))
                result = inspect_policy(root)
                self.assertEqual(result.manifest["policy"]["framework"], "lerobot")
                self.assertEqual(result.manifest["policy"]["architecture"], architecture)
                self.assertEqual(result.manifest["runtime"]["observation_shape"], config["input_features"])
                self.assertEqual(result.manifest["runtime"]["action_shape"], config["output_features"])
                self.assertIsNone(result.manifest["hardware"]["robot_family"])
                self.assertFalse(result.complete)

    def test_dependency_versions_hashes_and_unpinned_requirements(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "requirements.txt").write_text("lerobot==0.4.0\ntorch>=2\n-r extra.txt\n")
            (root / "extra.txt").write_text("numpy==2.1.0\n")
            dependencies, files = read_dependencies(root)
            self.assertIn("lerobot==0.4.0", dependencies)
            self.assertIn("numpy==2.1.0", dependencies)
            self.assertEqual(files, ["extra.txt", "requirements.txt"])
            self.assertTrue(any(d.startswith("file:requirements.txt#sha256:") for d in dependencies))
            result = inspect_policy(root)
            self.assertTrue(any(f.code == "dependency.unpinned" for f in result.findings))

    def test_dependency_include_cannot_escape_target(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "policy"
            root.mkdir()
            (Path(directory) / "secret.txt").write_text("never-read")
            (root / "requirements.txt").write_text("-r ../secret.txt")
            self.assertEqual(self.invoke(["check", str(root)])[0], 1)

    def test_conflicting_dependency_pins_and_ranges_are_rejected(self):
        m = copy.deepcopy(COMPLETE_MANIFEST)
        m["runtime"]["dependencies"] = ["torch==2.0.0", "torch==3.0.0"]
        self.assertTrue(validate_manifest(m))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "requirements.txt").write_text("torch>=3\ntorch==2.0.0\n")
            self.assertEqual(self.invoke(["check", directory])[0], 1)

    def test_negative_dataset_dimensions_rejected(self):
        m = copy.deepcopy(COMPLETE_MANIFEST)
        m["dataset"]["schema"] = {"action": {"dtype": "float32", "shape": [-1]}}
        self.assertTrue(validate_manifest(m))

    def test_malformed_dependency_types_fail_cleanly(self):
        with tempfile.TemporaryDirectory() as directory:
            (Path(directory) / "pyproject.toml").write_text('[project]\ndependencies=42\n')
            self.assertEqual(self.invoke(["check", directory])[0], 1)

    def test_pyproject_and_lock_resolve_pins_and_framework_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config.json").write_text('{"policy":{"type":"act"}}')
            (root / "pyproject.toml").write_text('[project]\ndependencies=["lerobot>=0.4"]\n')
            (root / "uv.lock").write_text('[[package]]\nname="lerobot"\nversion="0.4.0"\n')
            result = inspect_policy(root)
            self.assertEqual(result.manifest["policy"]["framework_version"], "0.4.0")
            self.assertNotIn("lerobot>=0.4", result.manifest["runtime"]["dependencies"])

    def test_dirty_policy_is_not_complete(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", directory], check=True)
            (root / "robot-skill.json").write_text(json.dumps(COMPLETE_MANIFEST))
            self.assertTrue(any(f.code == "source.dirty" for f in inspect_policy(root).findings))


class TargetTests(unittest.TestCase):
    def manifest(self):
        m = copy.deepcopy(COMPLETE_MANIFEST)
        m["hardware"]["sensors"][0]["calibration"] = "sha256:" + "c" * 64
        for field in ("observation_shape", "action_shape"):
            m["runtime"][field] = {"joint": {"shape": [6], "dtype": "float32", "semantics": {"units": "radians", "joint_order": ["a", "b", "c", "d", "e", "f"], "normalization": "none", "frame": "joint"}}}
        return m

    def target(self, m):
        return {key: copy.deepcopy(m[key]) for key in ("schema_version", "hardware", "runtime", "policy")}

    def test_full_match_is_declared_only_not_reproduction(self):
        m = self.manifest()
        report, findings = compare_target(m, self.target(m))
        self.assertEqual(findings, [])
        self.assertEqual(report["status"], "match")
        self.assertFalse(report["physical_transfer_verified"])

    def test_mismatches_and_unknown_fields_fail_conservatively(self):
        for section, field, value in (("hardware", "robot_family", "SO-100"),
                                      ("runtime", "control_frequency_hz", 20),
                                      ("policy", "framework_version", "0.3.0"),
                                      ("hardware", "gripper", None),
                                      ("runtime", "dependencies", [])):
            with self.subTest(field=field):
                m = self.manifest()
                target = self.target(m)
                target[section][field] = value
                report, findings = compare_target(m, target)
                self.assertNotEqual(report["status"], "match")
                self.assertTrue(findings)

    def test_same_shape_without_semantics_is_unknown(self):
        m = self.manifest()
        m["runtime"]["action_shape"] = {"action": [6]}
        self.assertEqual(compare_target(m, self.target(m))[0]["status"], "unknown")

    def test_joint_order_difference_is_mismatch(self):
        m = self.manifest()
        target = self.target(m)
        target["runtime"]["action_shape"]["joint"]["semantics"]["joint_order"].reverse()
        self.assertEqual(compare_target(m, target)[0]["status"], "mismatch")

    def test_cli_target_comparison_returns_machine_readable_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            m = self.manifest()
            target = self.target(m)
            target["hardware"]["robot_family"] = "SO-100"
            (root / "robot-skill.json").write_text(json.dumps(m))
            (root / "target.json").write_text(json.dumps(target))
            output = StringIO()
            with redirect_stdout(output):
                code = main(["check", directory, "--target", str(root / "target.json"), "--no-write", "--format", "json"])
            self.assertEqual(code, 2)
            self.assertEqual(json.loads(output.getvalue())["target_comparison"]["status"], "mismatch")

    def test_invalid_target_is_an_input_error(self):
        with self.assertRaises(ValueError):
            compare_target(self.manifest(), {"schema_version": "1.0"})


if __name__ == "__main__":
    unittest.main()
