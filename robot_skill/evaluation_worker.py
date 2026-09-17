"""One seeded simulator trial. Never invoked by the metadata validator."""
from __future__ import annotations

import argparse
import importlib.util
import json
import time
import zipfile
from pathlib import Path

from .evaluation import digest_file, write_json


def policy_for(job: dict, observation: dict, env, seed: int):
    import numpy as np
    if digest_file(Path(job["artifact"])) != job["artifact_sha256"]:
        raise ValueError("Policy artifact digest changed.")
    if job["config"]["policy"]["kind"] == "python":
        spec = importlib.util.spec_from_file_location("knownrobot_local_policy", job["artifact"])
        if spec is None or spec.loader is None:
            raise ValueError("Cannot load the local Python policy.")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        policy = module.make_policy(env.observation_space, env.action_space, seed)
        if not callable(policy):
            raise ValueError("make_policy must return a callable observation-to-action policy.")
        return policy
    # Safe NumPy archive loading: no pickle or executable deserialization.
    with zipfile.ZipFile(job["artifact"]) as archive:
        if len(archive.infolist()) > 64 or sum(item.file_size for item in archive.infolist()) > 256 * 1024 * 1024:
            raise ValueError("MLP archive exceeds 64 arrays or 256 MiB decompressed.")
    with np.load(job["artifact"], allow_pickle=False) as archive:
        keys = set(archive.files)
        count = len(keys) // 2
        if not count or count > 32 or keys != {f"{kind}_{index}" for index in range(count) for kind in ("weight", "bias")}:
            raise ValueError("MLP archive must contain consecutive weight_N/bias_N pairs only (1–32 layers).")
        layers = [(np.asarray(archive[f"weight_{i}"], dtype=np.float64), np.asarray(archive[f"bias_{i}"], dtype=np.float64)) for i in range(count)]
    width = np.concatenate([observation["observation"], observation["desired_goal"]]).size
    for weight, bias in layers:
        if weight.ndim != 2 or weight.shape[0] != width or bias.shape != (weight.shape[1],) or not np.isfinite(weight).all() or not np.isfinite(bias).all():
            raise ValueError("Invalid MLP dimensions or nonfinite weights.")
        width = weight.shape[1]
    if width != env.action_space.shape[0]:
        raise ValueError("MLP output dimension does not match simulator actions.")
    def select(obs):
        value = np.concatenate([obs["observation"], obs["desired_goal"]])
        for weight, bias in layers:
            value = np.tanh(value @ weight + bias)
        return (env.action_space.low + (value + 1) * (env.action_space.high - env.action_space.low) / 2).astype(env.action_space.dtype)
    return select


def run_trial(job: dict, index: int, trace: Path) -> dict:
    import numpy as np
    import gymnasium as gym
    import gymnasium_robotics
    gym.register_envs(gymnasium_robotics)
    seed = job["config"]["seed"] + index
    result = {"seed": seed, "started": False, "success": False, "outcome": "error", "steps": 0}
    env = None
    try:
        env = gym.make(job["config"]["environment"], max_episode_steps=job["config"]["max_steps"])
        env.action_space.seed(seed)
        obs, _ = env.reset(seed=seed)
        result["started"] = True
        result["environment"] = {"id": job["config"]["environment"], "simulation_dt_seconds": float(env.unwrapped.dt),
                                 "observation_shapes": {key: list(value.shape) for key, value in obs.items()},
                                 "action_shape": list(env.action_space.shape)}
        with trace.open("x", encoding="utf-8") as stream:
            def record(value):
                stream.write(json.dumps(value, allow_nan=False, separators=(",", ":")) + "\n")
                stream.flush()
            record({"reset": True, "seed": seed, "observation": {key: value.tolist() for key, value in obs.items()}})
            policy = policy_for(job, obs, env, seed)
            elapsed = []
            for step in range(job["config"]["max_steps"]):
                before = time.perf_counter()
                action = np.asarray(policy(obs), dtype=env.action_space.dtype)
                elapsed.append((time.perf_counter() - before) * 1000)
                if not np.isfinite(action).all() or not env.action_space.contains(action):
                    raise ValueError("Policy action has invalid dimensions, nonfinite values or exceeds simulator limits.")
                obs, reward, terminated, truncated, info = env.step(action)
                if "is_success" not in info or float(info["is_success"]) not in (0, 1):
                    raise ValueError("Simulator did not provide an unambiguous success signal.")
                result["steps"] = step + 1
                result["success"] = bool(info["is_success"])
                record({"step": step + 1, "action": action.tolist(), "observation": {key: value.tolist() for key, value in obs.items()},
                        "reward": float(reward), "terminated": bool(terminated), "truncated": bool(truncated), "success": result["success"]})
                if terminated or truncated:
                    break
            result.update(outcome="success" if result["success"] else "failure",
                          inference_latency_ms={"mean": float(np.mean(elapsed)), "p95": float(np.percentile(elapsed, 95)), "max": max(elapsed)})
    except Exception as exc:
        result.update(success=False, outcome="error", error=f"{type(exc).__name__}: {exc}"[:2000])
    finally:
        if env is not None:
            env.close()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", required=True)
    parser.add_argument("--trial", required=True, type=int)
    parser.add_argument("--result", required=True)
    parser.add_argument("--trace", required=True)
    args = parser.parse_args()
    job = json.loads(Path(args.job).read_text(encoding="utf-8"))
    write_json(Path(args.result), run_trial(job, args.trial, Path(args.trace)))


if __name__ == "__main__":
    main()
