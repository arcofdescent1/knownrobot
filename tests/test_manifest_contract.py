import copy
import json
import unittest
from pathlib import Path
from robot_skill.publication import publication_findings
from robot_skill.schema import validate_manifest


class ManifestContractTests(unittest.TestCase):
    def test_shared_runtime_vectors(self):
        baseline = json.loads(Path('embodied-registry/schema/example.robot-skill.json').read_text())
        for case in json.loads(Path('robot_skill/manifest-contract.cases.json').read_text()):
            value = copy.deepcopy(baseline)
            for path, replacement in case['changes']:
                keys = path.split('.')
                target = value
                for key in keys[:-1]:
                    target = target[int(key)] if isinstance(target,list) else target[key]
                if isinstance(target,list): target[int(keys[-1])] = replacement
                else: target[keys[-1]] = replacement
            with self.subTest(case=case['name']):
                self.assertEqual(not validate_manifest(value),case['valid'])
                self.assertEqual(not publication_findings(value),case['complete'])
