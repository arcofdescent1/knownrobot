from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from robot_skill.database import export_published_assessments, sync_assessment


RECORD = {
    "record_type": "external_policy_assessment", "schema_version": "1.0", "slug": "owner-policy-aaaaaaaa",
    "source": {"provider": "huggingface", "repository": "owner/policy", "revision": "a" * 40},
    "assessment": {"artifact_intents": ["task_policy"]},
}
ASSESSOR = "00000000-0000-0000-0000-000000000001"


class AssessmentDatabaseTests(unittest.TestCase):
    @patch("robot_skill.database._record", return_value=RECORD)
    @patch("robot_skill.database._credentials", return_value=("https://project.supabase.co", "secret"))
    @patch("robot_skill.database._request")
    def test_new_record_must_enter_as_draft(self, request, _credentials, _record):
        request.return_value = []
        with self.assertRaisesRegex(ValueError, "enter as draft"):
            sync_assessment(Path("bundle"), "published", ASSESSOR)
        request.side_effect = [[], [{"id": "assessment-id", "lifecycle": "draft"}]]
        result = sync_assessment(Path("bundle"), "draft", ASSESSOR)
        self.assertEqual(result["status"], "created")
        self.assertEqual(request.call_args_list[-1].args[2], "POST")

    @patch("robot_skill.database._record", return_value=RECORD)
    @patch("robot_skill.database._credentials", return_value=("https://project.supabase.co", "secret"))
    @patch("robot_skill.database._request")
    def test_lifecycle_only_advances_and_published_content_is_idempotent(self, request, _credentials, _record):
        existing = {"id": "assessment-id", "lifecycle": "draft", "assessor_id": ASSESSOR, "record": RECORD}
        request.side_effect = [[existing], [{"id": "assessment-id", "lifecycle": "review"}]]
        self.assertEqual(sync_assessment(Path("bundle"), "review", ASSESSOR)["lifecycle"], "review")
        published = {**existing, "lifecycle": "published"}
        request.side_effect = [[published]]
        self.assertEqual(sync_assessment(Path("bundle"), "published", ASSESSOR)["status"], "unchanged")
        request.side_effect = [[published]]
        with self.assertRaisesRegex(ValueError, "Invalid lifecycle transition"):
            sync_assessment(Path("bundle"), "review", ASSESSOR)

    @patch.dict(os.environ, {"SUPABASE_URL": "https://project.supabase.co", "SUPABASE_ANON_KEY": "anon"}, clear=True)
    @patch("robot_skill.database._request", return_value=[{"record": RECORD}])
    def test_export_is_atomic_audit_catalog(self, _request):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "catalog.json"
            result = export_published_assessments(output)
            self.assertEqual(result["records"], 1)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), [RECORD])


if __name__ == "__main__":
    unittest.main()
