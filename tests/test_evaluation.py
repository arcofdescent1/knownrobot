from __future__ import annotations

import copy
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from robot_skill.evaluation import digest_file, evaluate, load_job, verify_bundle

SIM_AVAILABLE = all(importlib.util.find_spec(name) for name in ("gymnasium", "gymnasium_robotics", "mujoco", "numpy"))
if os.environ.get("KNOWNROBOT_REQUIRE_SIM_TESTS") == "1" and not SIM_AVAILABLE:
    raise RuntimeError("Required simulator tests cannot be skipped: install the evaluation extra.")


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        manifest = json.loads(Path("embodied-registry/schema/example.robot-skill.json").read_text())
        manifest["skill"]["name"] = "Simulator regression fixture"
        manifest["hardware"] = {"robot_family": "Fetch", "gripper": "Fetch", "sensors": []}
        manifest["policy"] = {"framework": "numpy", "framework_version": "2.2.6", "architecture": "mlp", "checkpoint": "policy.npz"}
        manifest["compatibility"] = []
        manifest["evaluations"] = []
        (self.root / "manifest.json").write_text(json.dumps(manifest))
        shutil.copyfile("tests/fixtures/fetch_reach_controller.py", self.root / "policy.py")
        self.config = {"format": "knownrobot-evaluation/1.0", "environment": "FetchReach-v4", "trials": 2, "seed": 42,
                       "max_steps": 50, "trial_timeout_seconds": 30, "manifest": "manifest.json",
                       "policy": {"kind": "python", "path": "policy.py", "sha256": digest_file(self.root / "policy.py")}}
        self.path = self.root / "evaluation.json"

    def save(self):
        self.path.write_text(json.dumps(self.config))
        return self.path

    def test_execution_and_python_trust_are_explicit(self):
        with self.assertRaisesRegex(ValueError, "allow-execution"):
            evaluate(self.save(), self.root / "out", allow_execution=False)
        with self.assertRaisesRegex(ValueError, "trust-policy"):
            load_job(self.save(), False)
        self.assertFalse((self.root / "out").exists())

    def test_invalid_protocol_and_artifacts_fail_before_execution(self):
        for change in ({"environment": "SO101-real"}, {"trials": 0}, {"trials": True}, {"seed": -1},
                       {"max_steps": 0}, {"trial_timeout_seconds": 0}, {"unexpected": 1}, {"manifest": "../missing"}):
            with self.subTest(change=change):
                original = copy.deepcopy(self.config)
                self.config.update(change)
                with self.assertRaises(ValueError):
                    load_job(self.save(), True)
                self.config = original
        self.config["policy"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            load_job(self.save(), True)

    @unittest.skipUnless(SIM_AVAILABLE, "Optional simulator dependencies not installed")
    def test_actual_fetch_success_reproducibility_export_and_integrity(self):
        first = evaluate(self.save(), self.root / "first", allow_execution=True, trust_policy=True, evidence_url="https://example.com/regression-evidence")
        second = evaluate(self.save(), self.root / "second", allow_execution=True, trust_policy=True)
        self.assertEqual(first["trial_count"], 2)
        self.assertEqual(first["success_count"], 2)
        self.assertEqual(first["errors"], 0)
        for index in (1, 2):
            self.assertEqual(digest_file(self.root / "first" / f"trace-{index:04d}.jsonl"), digest_file(self.root / "second" / f"trace-{index:04d}.jsonl"))
        self.assertEqual(verify_bundle(self.root / "first")["success_count"], 2)
        payload = json.loads((self.root / "first/submission.json").read_text())
        self.assertEqual(payload["robot_family"], "Fetch")
        self.assertEqual(payload["runtime"]["execution"], "simulation")
        self.assertNotIn("verification_status", payload)
        node = shutil.which("node")
        contract = Path("embodied-registry/.test-build/src/lib/identity-contract.js").resolve()
        if node and contract.is_file():
            check = subprocess.run([node, "-e", "const fs=require('node:fs'); const {submissionSchema}=require(process.argv[1]); submissionSchema.parse(JSON.parse(fs.readFileSync(0,'utf8')));", str(contract)], input=json.dumps(payload), text=True, capture_output=True)
            self.assertEqual(check.returncode, 0, check.stderr)
        self.assertFalse((self.root / "first/job.json").exists())
        with self.assertRaises(FileExistsError):
            evaluate(self.save(), self.root / "first", allow_execution=True, trust_policy=True)
        (self.root / "first/trace-0001.jsonl").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "checksum"):
            verify_bundle(self.root / "first")
        # Recomputed checksums alone cannot hide contradictory result counts.
        altered = self.root / "second/result.json"
        report = json.loads(altered.read_text())
        report["success_count"] = 99
        altered.write_text(json.dumps(report))
        inventory_path = self.root / "second/checksums.json"
        inventory = json.loads(inventory_path.read_text())
        inventory["sha256"]["result.json"] = digest_file(altered)
        inventory_path.write_text(json.dumps(inventory))
        with self.assertRaisesRegex(ValueError, "counts"):
            verify_bundle(self.root / "second")

    @unittest.skipUnless(SIM_AVAILABLE, "Optional simulator dependencies not installed")
    def test_actual_numpy_pick_and_place_counts_failures(self):
        import numpy as np
        np.savez(self.root / "policy.npz", weight_0=np.zeros((28, 4)), bias_0=np.zeros(4))
        self.config.update(environment="FetchPickAndPlace-v4", max_steps=5)
        self.config["policy"] = {"kind": "numpy_mlp", "path": "policy.npz", "sha256": digest_file(self.root / "policy.npz")}
        result = evaluate(self.save(), self.root / "failed", allow_execution=True)
        self.assertEqual(result["trial_count"], 2)
        self.assertEqual(result["success_count"], 0)
        self.assertEqual(result["errors"], 0)
        self.assertEqual(verify_bundle(self.root / "failed")["success_count"], 0)

    @unittest.skipUnless(SIM_AVAILABLE, "Optional simulator dependencies not installed")
    def test_invalid_actions_count_as_failures_not_exclusions(self):
        (self.root / "policy.py").write_text("def make_policy(observation_space, action_space, seed):\n    return lambda obs: [float('nan')]*4\n")
        self.config["policy"]["sha256"] = digest_file(self.root / "policy.py")
        result = evaluate(self.save(), self.root / "bad", allow_execution=True, trust_policy=True)
        self.assertEqual(result["trial_count"], 2)
        self.assertEqual(result["success_count"], 0)
        self.assertEqual(result["errors"], 2)
        self.assertEqual(verify_bundle(self.root / "bad")["trial_count"], 2)

    @unittest.skipUnless(SIM_AVAILABLE, "Optional simulator dependencies not installed")
    def test_timeouts_preserve_reset_attempts(self):
        self.config.update(trials=1, trial_timeout_seconds=1)
        with patch("robot_skill.evaluation.execute_worker", side_effect=subprocess.TimeoutExpired("worker", 1)):
            result = evaluate(self.save(), self.root / "timeout", allow_execution=True, trust_policy=True)
        self.assertEqual(result["errors"], 1)
        self.assertEqual(result["trial_count"], 0)
        self.assertIsNone(result["success_rate"])
        self.assertFalse((self.root / "timeout/submission.json").exists())
        self.assertEqual(verify_bundle(self.root / "timeout")["trial_count"], 0)

    @unittest.skipUnless(SIM_AVAILABLE, "Optional simulator dependencies not installed")
    def test_actual_timeout_retains_started_trial_and_failed_result(self):
        (self.root / "policy.py").write_text("import time\ndef make_policy(observation_space, action_space, seed):\n    time.sleep(60)\n    return lambda obs: [0]*4\n")
        self.config.update(trials=1, trial_timeout_seconds=3)
        self.config["policy"]["sha256"] = digest_file(self.root / "policy.py")
        result = evaluate(self.save(), self.root / "hung", allow_execution=True, trust_policy=True)
        self.assertEqual(result["trial_count"], 1)
        self.assertEqual(result["errors"], 1)
        self.assertEqual(result["success_count"], 0)
        self.assertEqual(verify_bundle(self.root / "hung")["trial_count"], 1)
