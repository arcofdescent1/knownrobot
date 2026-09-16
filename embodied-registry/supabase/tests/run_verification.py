"""Real PostgreSQL authorization and concurrency tests in a disposable database.

Uses psql and standard lib only. PGHOST/PGPORT/PGUSER/PGPASSWORD configure an
administrative TEST server; the script never migrates an existing database.
"""
from pathlib import Path
import shutil
import subprocess
import uuid


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
        for migration in sorted((root / "migrations").glob("*.sql")):
            subprocess.run(db + ["-f", str(migration)], check=True)
        subprocess.run(db + ["-v", "keep_fixture=1", "-f", str(root / "tests/verification.sql")], check=True)
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
