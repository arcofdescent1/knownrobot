from __future__ import annotations

import json
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import yaml

from robot_skill.cli import main
from robot_skill.inspector import inspect_policy
from robot_skill.schema import load_schema, validate_manifest


COMPLETE_MANIFEST = {
    "schema_version": "1.0",
    "skill": {"name": "Cube transfer", "version": "1.0.0", "source": {"type": "huggingface", "repository": "lab/cube", "revision": "abcdef123456"}},
    "policy": {"framework": "lerobot", "framework_version": "0.4.0", "architecture": "act"},
    "hardware": {"robot_family": "SO-101", "gripper": "standard", "sensors": [{"type": "rgb", "name": "wrist"}]},
    "runtime": {"control_frequency_hz": 30, "observation_shape": {"state": [6]}, "action_shape": {"action": [6]}, "dependencies": ["pyproject.toml"]},
    "dataset": {"repository": "lab/cube-data", "schema": {"action": "float32[6]"}},
    "compatibility": [{"robot_family": "SO-101", "status": "compatible", "evidence": "evaluation.json"}],
    "evaluations": [{"benchmark": "cube-v1", "trials": 10, "successes": 8, "evaluator": "Lab A", "date": "2026-08-14"}],
}


class ValidatorTests(unittest.TestCase):
    def test_complete_manifest_passes(self):
        self.assertEqual(validate_manifest(COMPLETE_MANIFEST), [])

    def test_published_example_and_schema_pass(self):
        example = json.loads(Path("embodied-registry/schema/example.robot-skill.json").read_text(encoding="utf-8"))
        self.assertEqual(validate_manifest(example), [])
        self.assertEqual(load_schema()["$id"], "https://knownrobot.com/schema/robot-skill/1.0.json")

    def test_invalid_manifest_fails(self):
        invalid = dict(COMPLETE_MANIFEST, schema_version="0.1")
        self.assertTrue(validate_manifest(invalid))

    def test_existing_manifest_is_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "robot-skill.yaml").write_text(yaml.safe_dump(COMPLETE_MANIFEST), encoding="utf-8")
            self.assertTrue(inspect_policy(root).complete)

    def test_check_writes_portable_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "config.json").write_text(json.dumps({"policy": {"type": "act"}, "robot": {"type": "SO-101"}, "dataset": {"repo_id": "lab/data", "fps": 30}}), encoding="utf-8")
            (root / "pyproject.toml").write_text("[project]\nname='sample'\n", encoding="utf-8")
            output = root / "out.yaml"
            with redirect_stdout(StringIO()):
                code = main(["check", str(root), "--output", str(output)])
            self.assertEqual(code, 0)
            self.assertTrue(output.is_file())
            self.assertEqual(yaml.safe_load(output.read_text(encoding="utf-8"))["schema_version"], "1.0")

    def test_strict_mode_uses_machine_readable_exit_code(self):
        with tempfile.TemporaryDirectory() as directory, redirect_stdout(StringIO()):
            self.assertEqual(main(["check", directory, "--strict", "--no-write"]), 2)

    def test_json_diagnostics_are_parseable(self):
        with tempfile.TemporaryDirectory() as directory:
            stream = StringIO()
            with redirect_stdout(stream):
                main(["check", directory, "--format", "json", "--no-write"])
            self.assertIn("findings", json.loads(stream.getvalue()))

    def test_validate_rejects_missing_file(self):
        with tempfile.TemporaryDirectory() as directory, redirect_stdout(StringIO()):
            self.assertEqual(main(["validate", str(Path(directory) / "missing.yaml")]), 1)


class RepresentativeLayoutTests(unittest.TestCase):
    """Ten repository layouts modeled on policy metadata conventions in the ecosystem."""

    CASES = [
        ("lerobot-act", {"policy": {"type": "act"}, "robot": {"type": "SO-101"}, "dataset": {"fps": 30}}),
        ("lerobot-smolvla", {"policy_type": "smolvla", "robot_type": "SO-100", "fps": 30}),
        ("robomimic-bc", {"architecture": "bc", "framework": "robomimic", "control_frequency_hz": 20}),
        ("diffusion-policy", {"model_type": "diffusion", "control_frequency_hz": 10}),
        ("pi0-checkpoint", {"architecture": "pi0", "robot": "aloha", "fps": 50}),
        ("vqbet-policy", {"policy_type": "vqbet", "robot_type": "xarm", "fps": 20}),
        ("tdmpc-policy", {"architecture": "tdmpc", "robot": "franka", "fps": 20}),
        ("ros2-policy", {"architecture": "ppo", "robot": "ur5e", "control_frequency_hz": 100}),
        ("dataset-info", {"policy": {"type": "act"}, "dataset": {"repo_id": "lab/data", "features": {"action": [6]}, "fps": 30}}),
        ("local-policy", {"architecture": "sac", "robot_type": "widowx", "fps": 20}),
    ]

    def test_ten_layouts_generate_structurally_valid_manifests(self):
        for name, config in self.CASES:
            with self.subTest(name=name), tempfile.TemporaryDirectory(prefix=name) as directory:
                root = Path(directory)
                (root / "config.json").write_text(json.dumps(config), encoding="utf-8")
                (root / "requirements.txt").write_text("torch\n", encoding="utf-8")
                result = inspect_policy(root)
                self.assertFalse(any(item.code == "schema.invalid" for item in result.findings))
                self.assertEqual(result.manifest["schema_version"], "1.0")


if __name__ == "__main__":
    unittest.main()
