"""Execute an installed wheel outside the checkout; regression evidence only."""
import json
import sys
import tempfile
from pathlib import Path

import numpy as np
from robot_skill.evaluation import digest_file, evaluate, verify_bundle


def main():
    source_manifest = Path(sys.argv[1])
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        manifest = json.loads(source_manifest.read_text(encoding="utf-8"))
        manifest["skill"]["name"] = "Installed-wheel simulator regression"
        manifest["hardware"] = {"robot_family": "Fetch", "gripper": "Fetch", "sensors": []}
        manifest["policy"] = {"framework": "numpy", "framework_version": "2.2.6", "architecture": "mlp", "checkpoint": "policy.npz"}
        manifest["compatibility"] = []
        manifest["evaluations"] = []
        (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        np.savez(root / "policy.npz", weight_0=np.zeros((28, 4)), bias_0=np.zeros(4))
        config = {"format": "knownrobot-evaluation/1.0", "environment": "FetchPickAndPlace-v4", "trials": 1,
                  "seed": 42, "max_steps": 5, "trial_timeout_seconds": 30, "manifest": "manifest.json",
                  "policy": {"kind": "numpy_mlp", "path": "policy.npz", "sha256": digest_file(root / "policy.npz")}}
        (root / "evaluation.json").write_text(json.dumps(config), encoding="utf-8")
        result = evaluate(root / "evaluation.json", root / "bundle", allow_execution=True)
        assert result["trial_count"] == 1 and result["errors"] == 0
        assert verify_bundle(root / "bundle")["status"] == "integrity_checked"
        print("PASS: installed-wheel actual MuJoCo execution and evidence integrity")


if __name__ == "__main__":
    main()
