/**
 * VENTURE IDENTITY AUDIT — which stored references does the code compare correctly?
 *
 * WHY THIS EXISTS
 *
 * A Venture has two identities: the internal id (`ventures.id`, stored) and the
 * decorative code (`ventures.venture_id`, `VNT-…`, what URLs and API paths carry).
 * The Phase 0 migration rewrote every stored reference to the internal id and
 * retyped 31 columns to uuid — which turned a whole class of comparison into a
 * runtime error, or worse, into a silent empty result:
 *
 *   A  `x.venture_id = v.id::text`   on a uuid column  → RAISES "uuid = text"
 *   B  a code bound to a uuid column (`venture_id = ?`) → RAISES invalid uuid
 *   C  a code bound where the column holds ids (text)   → EMPTY, no error
 *   D  a writer storing a code                          → an invisible row
 *
 * C is the dangerous one: `try/catch` around a read turns it into a blank screen.
 *
 * WHAT IT DOES
 *
 * Reads every SQL string literal in the Venture layers, keeps the ones that touch a
 * Venture-scoped table, and classifies how each compares `venture_id`. It also notes
 * whether the file resolves references at all (the resolver import), which is what
 * separates "compares an id it was handed" from "compares whatever the route passed".
 *
 * WHAT IT DOES NOT DO — read this before trusting a clean run
 *
 *   - SQL assembled by concatenation (`sql += ...`) is only seen in fragments.
 *   - A statement with no `venture_id` (a join through another table) is not judged.
 *   - "resolves in this file" is not "resolves before this query".
 * It is a screen that finds candidates in seconds; every candidate is still settled
 * by running it (scripts/db-audit, read-only) with BOTH forms.
 *
 * Usage:
 *   node scripts/db-audit/venture-identity-audit.mjs            — summary
 *   node scripts/db-audit/venture-identity-audit.mjs --list     — every site
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const LIST = process.argv.includes("--list");
const WRITES_ONLY = process.argv.includes("--writes");

/** Verified against production on 2026-10-15 (information_schema). A column in this
 *  set holds the INTERNAL id; comparing it to a text expression is class A or B. */
const UUID_VENTURE_ID_TABLES = new Set([
  "fundraising_campaigns", "startup_profile_documents", "startup_profile_progress",
  "startup_profiles", "tasks", "v2_followups", "venture_activity_log",
  "venture_change_log", "venture_dependencies", "venture_document_access_logs",
  "venture_document_shares", "venture_document_types", "venture_documents",
  "venture_founders", "venture_history", "venture_invitations",
  "venture_journey_stages", "venture_kpi_assignments", "venture_kpis",
  "venture_milestones", "venture_notes", "venture_notifications",
  "venture_operating_plans", "venture_origins", "venture_plan_imports",
  "venture_playbook_instances", "venture_reports", "venture_staff_assignments",
  "venture_updates", "venture_verifications", "webhooks",
]);

/** Still text — hold the internal id BY CONVENTION, so a code bound here matches
 *  nothing and says nothing (class C). */
const TEXT_VENTURE_ID_TABLES = new Set([
  "venture_assignee_emails", "venture_member_invitations", "venture_members",
  "venture_sessions", "venture_session_activity", "venture_reminder_log",
  "venture_deliverables", "venture_tasks", "venture_milestone_activity",
  "venture_standups", "venture_retros", "venture_validations",
  "venture_timeline_events", "venture_task_activity", "venture_kpi_definitions",
  "venture_customer_interviews", "venture_facilitator_playbook",
  "venture_coach_activity", "venture_coach_assignments", "venture_coaching_sessions",
  "venture_pmf_assessments", "venture_recommendations", "venture_mentor_feedback",
  "venture_feedback_activity", "venture_business_models", "venture_action_plans",
  "venture_advisors", "venture_audit_logs", "venture_reminder_rules",
]);

const SCANNED_DIRS = ["src/models", "src/services", "src/app/api", "src/lib"];

/** Every file under the scanned directories. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".js")) out.push(full);
  }
  return out;
}

/** SQL-shaped string literals: single-, double-quoted and template, multi-line. */
function sqlLiterals(source) {
  const found = [];
  const pattern = /(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const body = match[1].slice(1, -1);
    if (/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/i.test(body)) {
      found.push({ body, index: match.index });
    }
  }
  return found;
}

const lineOf = (source, index) => source.slice(0, index).split("\n").length;

/**
 * Does the function ENCLOSING this statement resolve the reference first?
 *
 * A file-level check is too blunt: the same file resolves in some readers and not
 * in others (ventureProfileStore resolves in four functions and not the fifth),
 * and that fifth one is exactly where the bug lives. So the question is asked of
 * the enclosing function body, from its declaration to the statement itself.
 */
function resolvesBefore(source, index) {
  const head = source.slice(0, index);
  const declaration = /(?:export\s+)?(?:async\s+)?function\s+[A-Za-z0-9_$]+/g;
  let start = 0;
  let match;
  while ((match = declaration.exec(head)) !== null) start = match.index;
  const body = head.slice(start);
  return (
    /resolveVentureInternalId/.test(body) ||
    /SELECT\s+id\s+FROM\s+ventures/i.test(body) ||
    /SELECT\s+id::text\s+AS\s+id\s+FROM\s+ventures/i.test(body)
  );
}

/** Which Venture-scoped tables the statement reads or writes. */
function tablesTouched(sql) {
  const touched = [];
  const pattern = /\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/gi;
  let match;
  while ((match = pattern.exec(sql)) !== null) {
    const table = match[1].toLowerCase();
    if (UUID_VENTURE_ID_TABLES.has(table) || TEXT_VENTURE_ID_TABLES.has(table)) {
      if (!touched.includes(table)) touched.push(table);
    }
  }
  return touched;
}

const findings = [];
const files = SCANNED_DIRS.flatMap((dir) => walk(path.join(PROJECT_ROOT, dir)));

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const resolves = /resolveVentureInternalId/.test(source);
  const relative = path.relative(PROJECT_ROOT, file).replace(/\\/g, "/");

  for (const { body, index } of sqlLiterals(source)) {
    const tables = tablesTouched(body);
    if (tables.length === 0) continue;
    if (!/venture_id/i.test(body)) continue;

    const uuidTables = tables.filter((table) => UUID_VENTURE_ID_TABLES.has(table));
    const textTables = tables.filter((table) => TEXT_VENTURE_ID_TABLES.has(table));

    // A — a uuid column compared to a text expression.
    const castText = /([a-z_]+\.)?venture_id\s*=\s*[a-z0-9_]+\.id::text/i.test(body)
      || /[a-z0-9_]+\.id::text\s*=\s*([a-z_]+\.)?venture_id/i.test(body);
    // Tolerant — the column itself is cast, so type never breaks it.
    const tolerant = /venture_id::text/i.test(body);
    // Self-resolving — the statement resolves the reference in its own VALUES
    // clause (`(SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?)`),
    // the technique chosen for the append-only streams. Safe by construction.
    const selfResolving = /SELECT\s+id\s+FROM\s+ventures/i.test(body);
    if (selfResolving) continue;
    // B/C — a bare parameter.
    const bareParam = /venture_id\s*(?:=|IN)\s*[?(]/i.test(body) || /venture_id\s+IN\s*\(\s*\$\{/i.test(body);

    let klass = null;
    if (castText && uuidTables.length > 0) klass = "A: uuid column vs text expression — RAISES";
    else if (bareParam && uuidTables.length > 0 && !tolerant) klass = "B: uuid column, caller-supplied reference";
    else if (bareParam && uuidTables.length === 0 && textTables.length > 0 && !tolerant) klass = "C: text column holding ids, code matches nothing";
    if (!klass) continue;

    findings.push({
      klass,
      file: relative,
      line: lineOf(source, index),
      tables: tables.join(", "),
      resolves,
      resolvedInFunction: resolvesBefore(source, index),
      write: /^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)/i.test(body),
      sql: body.replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }
}

const order = { A: 0, B: 1, C: 2 };
findings.sort((a, b) => {
  const ka = a.klass[0], kb = b.klass[0];
  if (order[ka] !== order[kb]) return order[ka] - order[kb];
  return `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`);
});

// `--writes` narrows to statements that CREATE or CHANGE a row: those fail loudly
// (the request errors) rather than showing an empty panel, so they come first.
const shown = WRITES_ONLY
  ? findings.filter((finding) => finding.write && !finding.resolvedInFunction)
  : findings;

console.log("=== VENTURE IDENTITY AUDIT ===");
console.log(`  files scanned: ${files.length}`);
console.log(`  sites flagged: ${findings.length}\n`);

let current = null;
for (const finding of shown) {
  if (LIST || WRITES_ONLY) {
    if (finding.klass !== current) {
      console.log(`\n--- ${finding.klass} ---`);
      current = finding.klass;
    }
    console.log(`  ${finding.file}:${finding.line}`);
    console.log(`      tables: ${finding.tables}  | resolves in function: ${finding.resolvedInFunction ? "yes" : "NO"}`);
    console.log(`      ${finding.sql}`);
  }
}

for (const klass of ["A", "B", "C"]) {
  const group = findings.filter((finding) => finding.klass.startsWith(klass));
  const unsettled = group.filter((finding) => !finding.resolvedInFunction);
  const unsettledWrites = unsettled.filter((finding) => finding.write);
  console.log(
    `  class ${klass}: ${group.length} site(s) — ${unsettled.length} with NO resolve in the enclosing function, ${unsettledWrites.length} of them writes`,
  );
}
console.log("\n  The last number is the one that matters: those are the sites to settle by");
console.log("  RUNNING them read-only with a code and with an id (scripts/db-audit/run-readonly.mjs).");
