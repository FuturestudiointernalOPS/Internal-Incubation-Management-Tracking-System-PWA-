#!/usr/bin/env python3
"""Exercise the WL migrations in a caller-created, networkless synthetic container.

Never reads .env files, never connects to an external database, never creates or
removes containers. Run with a fresh postgres:16-alpine container named
impactos-wl-synthetic-..., network=none, no mounted host data, and database
impactos_wl_synthetic. Never point this runner at the application's database.
"""
import argparse
import json
import re
import select
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "scripts/white-label/fixtures"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    if not args.container.startswith("impactos-wl-synthetic-"):
        raise SystemExit("Refusing an unrecognised container name")
    inspected = subprocess.run(["docker", "inspect", args.container], capture_output=True,
                               text=True, check=True, timeout=30)
    info = json.loads(inspected.stdout)[0]
    if (info["HostConfig"]["NetworkMode"] != "none" or info.get("Mounts")
            or info["Config"]["Image"] != "postgres:16-alpine"):
        raise SystemExit("Requires network=none, no mounted data and postgres:16-alpine")

    # A stopped/replaced container cannot be silently substituted during a run.
    container_id = info["Id"]
    # pg_isready can succeed against the temporary bootstrap server before
    # POSTGRES_DB exists. Wait for an actual read in the named fixture database.
    for _ in range(60):
        ready = subprocess.run(["docker", "exec", container_id, "psql", "-X", "-qAt",
                                "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d",
                                "impactos_wl_synthetic", "-c", "SELECT 1"],
                               capture_output=True, timeout=10)
        if ready.returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise SystemExit("Synthetic PostgreSQL did not become ready")

    def execute(sql):
        result = subprocess.run(["docker", "exec", "-i", container_id, "psql", "-X", "-q",
                                 "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "impactos_wl_synthetic"],
                                input=sql, text=True, capture_output=True, timeout=120)
        if result.returncode:
            raise RuntimeError(result.stderr)
        return result.stdout

    execute((FIXTURES / "programs-schema.sql").read_text())
    captured = subprocess.run([args.node, str(ROOT / "scripts/white-label/capture-program-queries.cjs")],
                             cwd=ROOT, capture_output=True, text=True, check=True, timeout=120)
    queries = json.loads(captured.stdout)

    def sql_literal(value):
        if value is None:
            return "NULL"
        if isinstance(value, bool):
            return "TRUE" if value else "FALSE"
        if isinstance(value, int):
            return str(value)
        if isinstance(value, list):
            return "ARRAY[" + ",".join(sql_literal(v) for v in value) + "]::text[]"
        if isinstance(value, str):
            return "'" + value.replace("'", "''") + "'"
        raise ValueError("Unsupported synthetic query argument")

    bound_queries = {}
    for name, query in queries.items():
        if "?" not in query["sql"] and query["args"]:
            indexes = {int(n) for n in re.findall(r"\$(\d+)", query["sql"])}
            if indexes != set(range(1, len(query["args"]) + 1)):
                raise ValueError("Unexpected numbered placeholders in " + name)
            bound_queries[name] = re.sub(r"\$(\d+)", lambda match: sql_literal(query["args"][int(match[1])-1]), query["sql"])
            continue
        parts = query["sql"].split("?")
        if len(parts) != len(query["args"]) + 1:
            raise ValueError("Unexpected placeholder count in " + name)
        bound_queries[name] = parts[0] + "".join(sql_literal(arg) + part for arg, part in zip(query["args"], parts[1:]))
    # The exact application predicate also works before the owner column exists.
    legacy_read = execute(bound_queries["internal.list"])
    if "Legacy synthetic programme" not in legacy_read:
        raise RuntimeError("Pre-migration internal compatibility failed")
    migrations = [ROOT / "supabase/migrations" / name for name in [
        "20261023_white_label_programs_foundation.sql",
        "20261023_white_label_programs_history.sql",
        "20261023_white_label_programs_supervision.sql",
        "20261029_white_label_programs_management.sql",
        "20261029_white_label_programs_sessions.sql",
        "20261029_white_label_branding.sql",
        "20260827_lms_foundation.sql",
        "20260901_lms_certificates.sql",
    ]]
    for _ in range(2):
        for migration in migrations:
            execute(migration.read_text())
    execute("""INSERT INTO lms_courses
      (id,title,status,visibility,created_by)
      VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic platform course',
        'published','public','SYNTH-PERSON');
    INSERT INTO lms_enrollments
      (id,course_id,user_cid,source)
      VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTH-PERSON','admin');""")
    lms_ownership_migration = ROOT / "supabase/migrations/20261029_white_label_lms_ownership.sql"
    for _ in range(2):
        execute(lms_ownership_migration.read_text())
    migrations.append(lms_ownership_migration)
    lms_ownership_output = execute((FIXTURES / "lms-ownership-acceptance.sql").read_text())
    if "LMS ownership acceptance passed" not in lms_ownership_output:
        raise RuntimeError("LMS ownership acceptance completion marker missing")
    venture_ownership_migration = ROOT / "supabase/migrations/20261029_white_label_venture_ownership.sql"
    for _ in range(2):
        execute(venture_ownership_migration.read_text())
    migrations.append(venture_ownership_migration)
    venture_ownership_output = execute((FIXTURES / "venture-ownership-acceptance.sql").read_text())
    if "Venture ownership acceptance passed" not in venture_ownership_output:
        raise RuntimeError("Venture ownership acceptance completion marker missing")
    execute("""INSERT INTO organization_branding
      (organization_id,display_name,logo_url,primary_color,updated_by)
      VALUES ('00000000-0000-4000-8000-000000000001','Synthetic brand',
        'https://assets.example.invalid/logo.svg','#123456','SYNTH-PERSON');
    UPDATE organization_branding SET display_name='Synthetic brand updated'
      WHERE organization_id='00000000-0000-4000-8000-000000000001';
    DO $$ BEGIN
      ASSERT (SELECT count(*)=2 FROM organization_audit_events WHERE entity_type='organization_branding'),
        'Branding writes must be audited';
      ASSERT (SELECT access_level=3 FROM organization_role_template_capabilities
        WHERE template_key='org_admin' AND module='organization_admin' AND capability='branding.edit'),
        'Organisation administrators must receive the explicit branding capability';
      BEGIN
        DELETE FROM organization_branding WHERE organization_id='00000000-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'Branding deletion unexpectedly succeeded';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM NOT LIKE 'Organization branding is removed by clearing its values%' THEN
          RAISE;
        END IF;
      END;
    END $$;""")
    output = execute((FIXTURES / "programs-acceptance.sql").read_text())
    if "Synthetic acceptance passed" not in output:
        raise RuntimeError("Acceptance completion marker missing")
    execute((FIXTURES / "programs-workspace-schema.sql").read_text())
    supervision_test = (FIXTURES / "programs-supervision.sql").read_text()
    supervision_test = supervision_test.replace("-- WORKSPACE_ACCEPTANCE", (FIXTURES / "programs-workspace-acceptance.sql").read_text() + "\n" + (FIXTURES / "programs-context-acceptance.sql").read_text())
    for name, sql in bound_queries.items():
        supervision_test = supervision_test.replace("{{" + name + "}}", sql)
    if "{{" in supervision_test:
        raise RuntimeError("Unresolved supervision fixture placeholder")
    supervision_output = execute(supervision_test)
    if "Supervision acceptance passed" not in supervision_output:
        raise RuntimeError("Supervision completion marker missing")
    if "Workspace acceptance passed" not in supervision_output:
        raise RuntimeError("Workspace completion marker missing")
    if "Context acceptance passed" not in supervision_output:
        raise RuntimeError("Context completion marker missing")
    management_test = (FIXTURES / "programs-management-acceptance.sql").read_text()
    for name, sql in bound_queries.items():
        management_test = management_test.replace("{{" + name + "}}", sql)
    if "{{" in management_test:
        raise RuntimeError("Unresolved management fixture placeholder")
    management_output = execute(management_test)
    if "Management acceptance passed" not in management_output:
        raise RuntimeError("Management completion marker missing")
    # A second statement after waiting for the parent row must see the first
    # writer's committed revision. Test the actual model SQL on two connections.
    execute("""BEGIN;
      INSERT INTO organizations(id,code,name) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','revision-probe','Synthetic revision probe');
      SET LOCAL session_replication_role=replica;
      INSERT INTO v2_programs(id,organization_id,name,status) VALUES ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic revision probe','active');
      SET LOCAL session_replication_role=origin;
      INSERT INTO organization_program_revisions(id,organization_id) VALUES ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      COMMIT;""")
    writer = subprocess.Popen(["docker","exec","-i",container_id,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","impactos_wl_synthetic"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        writer.stdin.write("BEGIN; SET TRANSACTION ISOLATION LEVEL READ COMMITTED; " + bound_queries["management.parentLock"] + "; SELECT pg_sleep(1); " + bound_queries["management.update"] + "; " + bound_queries["management.revision"] + "; COMMIT;")
        writer.stdin.close()
        if not select.select([writer.stdout], [], [], 10)[0] or writer.stdout.readline().strip() != '44444444-4444-4444-8444-444444444444':
            raise RuntimeError("First writer did not acquire its scoped parent lock")
        execute("BEGIN; SET TRANSACTION ISOLATION LEVEL READ COMMITTED; " + bound_queries["management.parentLock"] + "; DO $$ BEGIN ASSERT (SELECT revision=2 FROM (" + bound_queries["management.program"] + ") p), 'Waiting writer retained a stale revision'; END $$; ROLLBACK;")
        if writer.wait(timeout=10):
            raise RuntimeError("Synthetic concurrent writer failed: " + writer.stderr.read())
    finally:
        if writer.poll() is None:
            writer.terminate()
            writer.wait(timeout=5)
    report = {
        "environment": "temporary Docker PostgreSQL 16; network none; no mounted host data",
        "fixture": "minimal synthetic compatibility schema, not a staging clone",
        "migrations": [m.name for m in migrations],
        "applicationsPerMigration": 2,
        "status": "passed",
        "checks": ["legacy row preservation", "legacy insert/edit/delete compatibility",
                   "client activation and client programme write locks", "same-organisation scopes",
                   "composite FK with validation trigger temporarily disabled",
                   "role scope and allow ceiling", "immutable identity and ended/revoked evidence",
                   "history deletion rejection", "append-only audit including truncate rejection",
                   "lifecycle audit attribution and before/after", "browser-role RLS denial",
                   "branding upsert and change audit", "explicit branding editor capability",
                   "branding deletion refusal", "LMS legacy platform backfill",
                   "LMS licensed enrolment and tenant-isolated attempts",
                   "LMS certificate scope and immutable course ownership",
                   "Venture legacy platform backfill and explicit assigned-read capability",
                   "Venture member and staff assignment scopes",
                   "Immutable venture ownership"],
        "productionAccessed": False,
        "fullStagingSchemaValidated": False,
        "endToEndClientPortalValidated": False,
    }
    report["supervision"] = {"status": "passed", "usesCapturedRepositorySQL": True,
      "checks": ["pre-migration internal reader", "internal root list/detail/templates/management filter",
        "internal activation/update exclude clients", "targeted read mandate", "other-organisation denial",
        "same-organisation list/detail", "mandatory audit and deadline recheck", "mandate lifecycle",
        "suspended organisation and contract denial", "disabled module and expired session denial",
        "export mandate does not implicitly grant read"]}
    report["workspace"] = {"status": "passed", "usesCapturedRepositorySQL": True,
      "checks": ["all 14 workspace reads exclude client parents", "legacy full-state reads preserved",
        "five export types exclude clients and preserve legacy output", "calendar, submissions and assigned programmes exclude clients",
        "KPI cache read scoped to platform parent"]}
    report["clientContext"] = {"status": "passed", "checks": ["fresh session and current membership", "candidate scope prerequisites", "compare-and-swap context update", "stale tab rejection", "context audit", "revocation and suspension", "platform-only aggregates and write perimeter"]}
    report["management"] = {"status": "passed", "usesCapturedRepositorySQL": True, "checks": ["explicit operation ceilings", "client activation remains blocked", "organisation ownership", "annual cohort preservation", "cross-organisation membership FK", "closed enrollment identity", "revision increments", "fresh revision after a competing parent-row lock", "audit attribution", "scoped session scheduling and closed-session history", "cohort and programme closure prerequisites", "browser RLS denial"]}
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
