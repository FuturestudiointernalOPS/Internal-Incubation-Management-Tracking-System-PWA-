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
    ]]
    for _ in range(2):
        for migration in migrations:
            execute(migration.read_text())
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
                   "lifecycle audit attribution and before/after", "browser-role RLS denial"],
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
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
