from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from robot_skill.assessment import create_huggingface_assessment, verify_assessment_bundle


REVISION = "6d403b142934aaef61fc07f5eec1515c4325751f"


class HuggingFaceAssessmentTests(unittest.TestCase):
    def fetcher(self, requested: list[str]):
        api = {
            "sha": REVISION,
            "author": "aadarshram",
            "cardData": {"license": "apache-2.0"},
            "siblings": [
                {"rfilename": "README.md"}, {"rfilename": "config.json"},
                {"rfilename": "model.safetensors"}, {"rfilename": "eval_demo.gif"},
            ],
        }
        config = {"policy": {"type": "act"}, "dataset": {"repo_id": "lerobot/pusht"}}
        payloads = {
            f"https://huggingface.co/api/models/aadarshram/act_pusht/revision/{REVISION}": json.dumps(api).encode(),
            f"https://huggingface.co/aadarshram/act_pusht/resolve/{REVISION}/README.md": b"---\nlibrary_name: lerobot\nlicense: apache-2.0\n---\n",
            f"https://huggingface.co/aadarshram/act_pusht/resolve/{REVISION}/config.json": json.dumps(config).encode(),
        }
        def fetch(url: str, limit: int) -> bytes:
            requested.append(url)
            if url not in payloads:
                raise AssertionError(f"Unexpected download: {url}")
            self.assertLessEqual(len(payloads[url]), limit)
            return payloads[url]
        return fetch

    def test_creates_bound_bundle_without_fetching_weights(self):
        requested: list[str] = []
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "assessment"
            record = create_huggingface_assessment(
                "aadarshram/act_pusht", REVISION, output, fetch=self.fetcher(requested),
                now=lambda: datetime(2026, 9, 24, 18, tzinfo=timezone.utc),
            )
            self.assertTrue((output / "assessment.json").is_file())
            self.assertTrue((output / "manifest.json").is_file())
            self.assertTrue((output / "checksums.json").is_file())
            self.assertTrue((output / "source" / "README.md").is_file())
            self.assertFalse(any("safetensors" in url or ".gif" in url for url in requested))
            self.assertEqual(record["manifest"]["skill"]["source"], {
                "type": "huggingface", "repository": "aadarshram/act_pusht", "revision": REVISION,
            })
            self.assertEqual(record["binding"]["source_revision"], REVISION)
            manifest_bytes = json.dumps(record["manifest"], ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode()
            self.assertEqual(record["binding"]["manifest_sha256"], hashlib.sha256(manifest_bytes).hexdigest())
            self.assertFalse(any(item["path"].startswith("skill.source") for item in record["findings"]["errors"]))
            self.assertFalse(record["assessment"]["executed_policy_code"])
            self.assertFalse(record["assessment"]["evaluated_policy"])
            self.assertEqual(record["manifest"]["skill"]["name"], "Act Pusht")
            self.assertEqual(len([item for item in record["findings"]["errors"] if item["code"] == "dependency.unresolved"]), 1)
            self.assertEqual(verify_assessment_bundle(output)["status"], "integrity_checked")

            (output / "source" / "config.json").write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                verify_assessment_bundle(output)

    def test_catalog_append_is_data_driven_and_duplicate_safe(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalog = root / "catalog.json"
            catalog.write_text("[]\n", encoding="utf-8")
            record = create_huggingface_assessment("aadarshram/act_pusht", REVISION, root / "first",
                                                  catalog=catalog, fetch=self.fetcher([]))
            self.assertEqual(json.loads(catalog.read_text(encoding="utf-8"))[0]["slug"], record["slug"])
            with self.assertRaisesRegex(ValueError, "already exists"):
                create_huggingface_assessment("aadarshram/act_pusht", REVISION, root / "second",
                                              catalog=catalog, fetch=self.fetcher([]))

    def test_claims_are_typed_attributed_pinned_and_integrity_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            claims = root / "claims.json"
            claims.write_text(json.dumps({"format": "knownrobot-upstream-claims/1.0", "claims": [
                {"category": "hardware", "claim": "The model card describes an SO-101 configuration."},
                {"category": "evaluation", "claim": "The model card reports an upstream evaluation result."},
            ]}), encoding="utf-8")
            output = root / "bundle"
            record = create_huggingface_assessment("aadarshram/act_pusht", REVISION, output,
                                                  claims=claims, fetch=self.fetcher([]))
            self.assertEqual([item["category"] for item in record["upstream_claims"]], ["hardware", "evaluation"])
            self.assertTrue(all(item["source_revision"] == REVISION and REVISION in item["source_url"] for item in record["upstream_claims"]))
            self.assertEqual(record["evidence_classes"]["knownrobot_measured_results"], [])
            self.assertEqual(record["evidence_classes"]["upstream_attributed_claims"], record["upstream_claims"])
            self.assertEqual(verify_assessment_bundle(output)["status"], "integrity_checked")
            document = json.loads((output / "claims.json").read_text(encoding="utf-8"))
            document["claims"][0]["claim"] = "Tampered"
            (output / "claims.json").write_text(json.dumps(document), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "claims document"):
                verify_assessment_bundle(output)

    def test_claims_reject_unknown_fields_and_categories(self):
        invalid_documents = [
            {"format": "knownrobot-upstream-claims/1.0", "claims": [{"category": "performance", "claim": "Claim"}]},
            {"format": "knownrobot-upstream-claims/1.0", "claims": [{"category": "hardware", "claim": "Claim", "verified": True}]},
        ]
        for document in invalid_documents:
            with self.subTest(document=document), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                claims = root / "claims.json"
                claims.write_text(json.dumps(document), encoding="utf-8")
                with self.assertRaises(ValueError):
                    create_huggingface_assessment("aadarshram/act_pusht", REVISION, root / "bundle",
                                                  claims=claims, fetch=self.fetcher([]))

    def test_rejects_mutable_or_abbreviated_revision_before_network(self):
        for revision in ("main", "6d403b1", "A" * 40):
            with self.subTest(revision=revision), tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(ValueError, "full lowercase 40-character"):
                    create_huggingface_assessment("aadarshram/act_pusht", revision, Path(directory) / "out",
                                                  fetch=lambda *_: self.fail("network must not be called"))

    def test_rejects_untrusted_repository_shapes(self):
        for repository in ("https://evil.test/x", "owner/name/extra", "../owner/name", "owner name/model"):
            with self.subTest(repository=repository), tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(ValueError, "owner/name"):
                    create_huggingface_assessment(repository, REVISION, Path(directory) / "out",
                                                  fetch=lambda *_: self.fail("network must not be called"))


if __name__ == "__main__":
    unittest.main()
