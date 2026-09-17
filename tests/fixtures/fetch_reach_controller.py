"""Deterministic feedback controller used only for real simulator regression tests.

This is not a learned manipulation policy or evidence of SO-101 compatibility.
"""
import numpy as np


def make_policy(observation_space, action_space, seed):
    def policy(observation):
        action = np.zeros(action_space.shape, dtype=action_space.dtype)
        action[:3] = np.clip(20 * (observation["desired_goal"] - observation["achieved_goal"]), -1, 1)
        return action
    return policy
