// Explicit staging deployment only. No application startup, build or test run.
// Usage: node scripts/white-label/apply-staging.mjs --apply
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const expectedProject = "mbpaxrfhqqclzyiefuab";
const files = [
  "20261023_white_label_programs_foundation.sql",
  "20261023_white_label_programs_history.sql",
  "20261023_white_label_programs_supervision.sql",
  "20261029_white_label_programs_management.sql",
  "20261029_white_label_programs_sessions.sql",
  "20261029_white_label_branding.sql",
  "20261029_white_label_lms_ownership.sql",
  "20261029_white_label_venture_ownership.sql",
  "20261119_white_label_client_activation.sql",
];
if (process.argv.length !== 3 || process.argv[2] !== "--apply") {
  console.log("No connection or changes. Use --apply for the fixed staging target only.");
  console.log(files.join("\n"));
  process.exit(0);
}

const env = readFileSync(path.join(root, ".env.local"), "utf8");
const databaseUrl = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!databaseUrl) throw new Error("Missing DATABASE_URL in .env.local");
const url = new URL(databaseUrl);
const project = decodeURIComponent(url.username).split(".").slice(1).join(".")
  || url.hostname.match(/^db\.([^.]+)\.supabase\.co$/)?.[1];
if (project !== expectedProject) throw new Error("Refusing target: staging project mismatch");

// Each reviewed source has one outer transaction. Keep all nine files within
// ONE transaction instead, retaining PL/pgSQL bodies without splitting SQL.
const migrations = files.map((file) => {
  const sql = readFileSync(path.join(root, "supabase/migrations", file), "utf8");
  const begin = sql.match(/^BEGIN;\s*$/m);
  if (!begin || !/COMMIT;\s*$/.test(sql)) throw new Error(`Unexpected transaction format: ${file}`);
  const body = sql.slice(begin.index + begin[0].length).replace(/COMMIT;\s*$/, "");
  if (/^\s*(?:BEGIN|COMMIT|ROLLBACK);\s*$/m.test(body)) throw new Error(`Nested transaction: ${file}`);
  return { file, body, sha256: createHash("sha256").update(sql).digest("hex") };
});

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: /sslmode=/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 90000,
});
client.on("notice", () => {});
let transaction = false;
let currentFile = null;
const report = { project, startedAt: new Date().toISOString(), committed: false, migrations: [] };
try {
  await client.connect();
  console.log(`Connected to staging project ${project}`);
  await client.query("BEGIN");
  transaction = true;
  await client.query("SET LOCAL lock_timeout = '5s'");
  await client.query("SET LOCAL statement_timeout = '60s'");
  await client.query("SET LOCAL search_path = public, pg_catalog");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('white-label-staging-deployment', 0))");
  // Foundation dependencies must already exist; never initialise legacy schema.
  const required = ["contacts", "v2_programs", "v2_sessions", "user_sessions", "ventures",
    "lms_courses", "lms_enrollments", "lms_assessments", "lms_assessment_attempts", "lms_certificates"];
  const { rows: prerequisites } = await client.query(
    "SELECT name, to_regclass('public.' || name)::text AS relation FROM unnest($1::text[]) name", [required],
  );
  if (prerequisites.some((row) => !row.relation)) throw new Error("Required legacy table missing; no migrations applied");
  for (const migration of migrations) {
    currentFile = migration.file;
    console.log(`Applying ${currentFile}`);
    await client.query(migration.body);
    report.migrations.push({ file: migration.file, sha256: migration.sha256 });
  }
  // Deployment inventory only: no fixture insertion or user-journey tests.
  report.tables = (await client.query(`
    SELECT c.relname AS name, c.relrowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (c.relname = 'organizations' OR c.relname LIKE 'organization\\_%' ESCAPE '\\')
    ORDER BY c.relname
  `)).rows;
  report.activationGuard = (await client.query(
    "SELECT pg_get_functiondef('public.wl_programs_preparation_guard()'::regprocedure) AS definition",
  )).rows[0].definition;
  await client.query("COMMIT");
  transaction = false;
  report.committed = true;
  report.finishedAt = new Date().toISOString();
  console.log(`Committed ${files.length} migrations; ${report.tables.length} organisation tables inventoried.`);
} catch (error) {
  if (transaction) await client.query("ROLLBACK").catch(() => {});
  report.error = { file: currentFile, code: error.code || null,
    message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]") };
  console.error(JSON.stringify({ rolledBack: transaction, ...report.error }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
  writeFileSync("/tmp/white-label-staging-deployment.json", JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
}
