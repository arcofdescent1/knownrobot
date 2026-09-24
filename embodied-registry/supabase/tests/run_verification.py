"""Real PostgreSQL authorization and concurrency tests in a disposable database.

Uses psql and standard lib only. PGHOST/PGPORT/PGUSER/PGPASSWORD configure an
administrative TEST server; the script never migrates an existing database.
"""
from pathlib import Path
import shutil
import subprocess
import uuid
import json
import copy


def main() -> None:
    psql = shutil.which("psql")
    if not psql:
        raise SystemExit("psql is required (PostgreSQL 17).")
    root = Path(__file__).resolve().parents[1]
    database = "knownrobot_verification_" + uuid.uuid4().hex
    base = [psql, "-X", "-v", "ON_ERROR_STOP=1"]
    subprocess.run(base + ["-d", "postgres", "-c", f'CREATE DATABASE "{database}"'], check=True)
    db = base + ["-d", database]
    try:
        # Roles are cluster-global. A dedicated test cluster is required.
        subprocess.run(db + ["-f", str(root / "tests/bootstrap.sql")], check=True)
        migrations = sorted((root / "migrations").glob("*.sql"))
        graph_migration = "202609180001_compatibility_graph.sql"
        for migration in migrations:
            if migration.name == graph_migration:
                # Seed reviewed legacy records before applying the additive graph
                # migration, so backfill is tested against real review snapshots.
                subprocess.run(db + ["-v", "keep_fixture=1", "-f", str(root / "tests/verification.sql")], check=True)
                subprocess.run(db + ["-c", "CREATE TABLE verification_test.before_graph AS SELECT "
                    "r.id, r.record FROM public.public_registry_records r"], check=True)
                fixture = json.loads((root.parent / "schema/example.robot-skill.json").read_text())
                fixture["skill"]["source"] = {"type": "local", "repository": "https://example.com/policy", "revision": "a" * 40}
                fixture["skill"]["license"] = "MIT"
                encoded = json.dumps(fixture).replace("'", "''")
                subprocess.run(db + ["-c", f"CREATE TABLE verification_test.manifest_fixture AS SELECT '{encoded}'::jsonb AS manifest; GRANT SELECT ON verification_test.manifest_fixture TO authenticated,anon"], check=True)
            subprocess.run(db + ["-f", str(migration)], check=True)
        subprocess.run(db + ["-c", "SELECT verification_test.assert_true("
            "NOT EXISTS (SELECT 1 FROM verification_test.before_graph old "
            "FULL JOIN public.public_registry_records current USING(id) WHERE old.record IS DISTINCT FROM current.record),"
            "'Graph backfill preserves exact published records and reviewed snapshots'); "
            "SELECT verification_test.assert_true((SELECT count(*) FROM public.evaluation_graph)="
            "(SELECT count(*) FROM public.evaluations),'Graph backfill includes every legacy evaluation')"], check=True)
        subprocess.run(db + ["-f", str(root / "tests/identity.sql")], check=True)
        subprocess.run(db + ["-f", str(root / "tests/compatibility_graph.sql")], check=True)
        subprocess.run(db + ["-f", str(root / "tests/external_assessments.sql")], check=True)
        baseline = json.loads((root.parent / "schema/example.robot-skill.json").read_text())
        for case in json.loads((root.parents[1] / "robot_skill/manifest-contract.cases.json").read_text()):
            manifest = copy.deepcopy(baseline)
            for path, replacement in case["changes"]:
                keys = path.split(".")
                target = manifest
                for key in keys[:-1]:
                    target = target[int(key)] if isinstance(target, list) else target[key]
                if isinstance(target, list):
                    target[int(keys[-1])] = replacement
                else:
                    target[keys[-1]] = replacement
            encoded = json.dumps(manifest).replace("'", "''")
            for complete, expected in [(False, case["valid"]), (True, case["complete"])]:
                sql = "SELECT verification_test.assert_true((public.robot_manifest_errors('%s'::jsonb,%s)='[]'::jsonb)=%s,'Manifest vector: %s')" % (encoded, str(complete).lower(), str(expected).lower(), case["name"].replace("'", "''"))
                subprocess.run(db + ["-c", sql], check=True)
        actor = "00000000-0000-0000-0000-000000000002"
        evaluation = "40000000-0000-0000-0000-000000000001"
        first_sql = f"""BEGIN;
SELECT id FROM public.evaluations WHERE id='{evaluation}' FOR UPDATE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '{actor}', true);
\\echo LOCK_ACQUIRED
SELECT pg_sleep(2);
SELECT (public.review_evaluation('{evaluation}',2,'reproduced',
'Independent evidence checked in concurrent review','https://example.com/first')).id;
COMMIT;
"""
        second_sql = f"""BEGIN; SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '{actor}', true);
SELECT (public.review_evaluation('{evaluation}',2,'reproduced',
'Independent evidence checked in concurrent review','https://example.com/second')).id;
COMMIT;"""
        first = subprocess.Popen(db + ["-q"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True)
        try:
            first.stdin.write(first_sql)
            first.stdin.close()
            first.stdin = None
            while True:
                line = first.stdout.readline()
                if "LOCK_ACQUIRED" in line:
                    break
                if not line:
                    raise RuntimeError("First review failed to acquire lock: " + first.stderr.read())
            second = subprocess.run(db + ["-v", "VERBOSITY=verbose", "-c", second_sql],
                                    capture_output=True, text=True, timeout=20)
            _, first_error = first.communicate(timeout=20)
            if first.returncode != 0:
                raise RuntimeError(first_error)
            if second.returncode == 0 or "40001" not in second.stderr:
                raise RuntimeError("Concurrent stale review was not rejected: " + second.stderr)
            subprocess.run(db + ["-c", "SELECT verification_test.assert_true("
                "(SELECT count(*)=3 FROM public.verification_reviews),"
                "'Concurrent reviews create exactly one additional decision')"], check=True)
            print("PASS: concurrent stale review rejected with SQLSTATE 40001")
        finally:
            if first.poll() is None:
                first.kill()
                first.communicate()
    finally:
        subprocess.run(base + ["-d", "postgres", "-c", f'DROP DATABASE "{database}" WITH (FORCE)'], check=True)


if __name__ == "__main__":
    main()
