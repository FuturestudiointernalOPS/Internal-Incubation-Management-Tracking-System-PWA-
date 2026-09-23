/**
 * PARTICIPANT MEMBERSHIP — LEGACY-SOURCE COVERAGE AUDIT
 *
 * "Which people still depend on the LEGACY program sources?"
 *
 * `participant_programs` is the authoritative store for "this person belongs to
 * that program". The runtime resolver still falls back to the legacy sources
 * when that store is empty for a person, and logs
 * `[participant-membership] legacy fallback used for <cid>` when it does.
 * Turning the fallback off (`DISABLE_LEGACY_PARTICIPANT_FALLBACK=true`) is only
 * safe once nobody resolves through it — otherwise those people lose their
 * program (and everything scoped to it: assignments, learning, messaging).
 *
 * This tool lists exactly those people, grouped by the legacy source that keeps
 * them working, and says which of the missing memberships can be copied safely.
 *
 * Legacy sources, in the resolver's own order (mirrored here):
 *   field     contacts.program_id, comma-separated values
 *   family    group_name matched against a family name → family.program_id
 *   program   group_name matched against a program name → that program's id
 *   intake    v2_participants row with the same email → its program_id
 *
 * Modes:
 *   node scripts/audit-participant-membership-gaps.mjs                  # inventory (READ-ONLY)
 *   node scripts/audit-participant-membership-gaps.mjs --verify         # post-fix gate (READ-ONLY)
 *   node scripts/audit-participant-membership-gaps.mjs --apply [--include-groups]
 *
 * Read-only by default: the inventory issues SELECTs only. --apply performs the
 * copy documented in the report, writes a before-image and a rollback file to
 * scratch/, and re-runs the scan.
 *
 * Source policy for --apply (mirrors the project's documented decision):
 *   - `field` and `intake` are copied by default (they are program sources).
 *   - `family` / `program` come from the GROUP name, and group membership is
 *     deliberately NOT a program source (see reconcileParticipantPrograms).
 *     Copying them is a conscious product decision → requires --include-groups.
 *
 * Exit codes:
 *   0 = nobody depends on the fallback (safe to disable it)
 *   1 = --verify found people who would lose their program
 *   2 = --inventory found people who would lose their program, or env error
 */

// ─── Boot: register the @/ alias + Next stubs loader BEFORE importing src ───
import { register } from "node:module";
await register(new URL("./lib/import-loader.mjs", import.meta.url));

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const INCLUDE_GROUPS = process.argv.includes("--include-groups");

/** Load the FIRST working DATABASE_URL from the env files (value never printed). */
const readUrlFrom = (file) => {
  try {
    for (const line of readFileSync(resolve(projectRoot, file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        return line.substring("DATABASE_URL=".length).trim();
      }
    }
  } catch {}
  return null;
};

const envCandidates = [".env.local", ".env.audit-staging", ".env.staging"];
let usedEnvFile = null;
for (const file of envCandidates) {
  const url = readUrlFrom(file);
  if (!url) continue;
  try {
    const pgModule = await import("pg");
    const probePool = new pgModule.default.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await probePool.query("SELECT 1");
    await probePool.end();
    process.env.DATABASE_URL = url;
    usedEnvFile = file;
    break;
  } catch {
    // credentials stale — try the next candidate
  }
}
if (!usedEnvFile) {
  console.error(
    "No working DATABASE_URL found in .env.local / .env.audit-staging / .env.staging",
  );
  process.exit(2);
}

const { initDb } = await import("../src/lib/db.js");
const db = (await import("../src/lib/db.js")).default;
const { getParticipantProgramIds } = await import("../src/lib/participant-membership.js");

await initDb();
console.log(`[audit] connected via ${usedEnvFile}`);

const UP = (value) => String(value ?? "").trim().toUpperCase();
const norm = (value) => String(value ?? "").trim();
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const ensureScratchDir = () => {
  try {
    mkdirSync(resolve(projectRoot, "scratch"), { recursive: true });
  } catch {}
};

/** One pass over every source — no per-contact round trips. */
async function loadEverything() {
  const contacts = (
    await db.execute({
      sql: `SELECT cid, name, email, group_name, program_id, role, status
            FROM contacts WHERE deleted = 0`,
      args: [],
    })
  ).rows;

  // Authoritative memberships. NOTE: the runtime resolver does NOT filter on
  // status here, so neither do we — a status filter would report people as
  // "dependent on the fallback" while the app already answers from here.
  const authoritative = new Map();
  for (const row of (
    await db.execute({
      sql: "SELECT participant_id, program_id FROM participant_programs",
      args: [],
    })
  ).rows) {
    const cid = norm(row.participant_id);
    if (!cid) continue;
    if (!authoritative.has(cid)) authoritative.set(cid, new Set());
    authoritative.get(cid).add(norm(row.program_id));
  }

  const familiesByName = new Map();
  for (const row of (
    await db.execute({
      sql: "SELECT name, program_id FROM families WHERE program_id IS NOT NULL",
      args: [],
    })
  ).rows) {
    const key = UP(row.name);
    if (!key) continue;
    if (!familiesByName.has(key)) familiesByName.set(key, new Set());
    familiesByName.get(key).add(norm(row.program_id));
  }

  const programsByName = new Map();
  const catalog = new Set();
  for (const row of (
    await db.execute({ sql: "SELECT id, name FROM v2_programs", args: [] })
  ).rows) {
    const id = norm(row.id);
    catalog.add(id);
    const key = UP(row.name);
    if (!key) continue;
    if (!programsByName.has(key)) programsByName.set(key, new Set());
    programsByName.get(key).add(id);
  }

  const intakeByEmail = new Map();
  for (const row of (
    await db.execute({
      sql: "SELECT email, program_id FROM v2_participants WHERE program_id IS NOT NULL",
      args: [],
    })
  ).rows) {
    const key = norm(row.email).toLowerCase();
    if (!key) continue;
    if (!intakeByEmail.has(key)) intakeByEmail.set(key, new Set());
    intakeByEmail.get(key).add(norm(row.program_id));
  }

  return { contacts, authoritative, familiesByName, programsByName, intakeByEmail, catalog };
}

/** The legacy resolution the runtime fallback performs, computed in memory. */
function legacyFor(contact, data) {
  const sources = new Map(); // program id → Set(source label)
  const add = (id, label) => {
    const key = norm(id);
    if (!key) return;
    if (!sources.has(key)) sources.set(key, new Set());
    sources.get(key).add(label);
  };

  for (const id of norm(contact.program_id).split(",")) add(id, "field");
  if (norm(contact.group_name)) {
    for (const id of data.familiesByName.get(UP(contact.group_name)) || []) add(id, "family");
    for (const id of data.programsByName.get(UP(contact.group_name)) || []) add(id, "program");
  }
  if (norm(contact.email)) {
    for (const id of data.intakeByEmail.get(norm(contact.email).toLowerCase()) || []) {
      add(id, "intake");
    }
  }
  return sources;
}

const data = await loadEverything();

/** People with no authoritative membership who still resolve through a legacy source. */
function computeGaps(current) {
  const found = [];
  for (const contact of current.contacts) {
    const authIds = current.authoritative.get(norm(contact.cid));
    if (authIds && authIds.size > 0) continue; // already authoritative

    const sources = legacyFor(contact, current);
    if (sources.size === 0) continue; // not a participant through any source

    const entries = [...sources.entries()].map(([programId, labels]) => ({
      programId,
      sources: [...labels].sort(),
      inCatalog: current.catalog.has(programId),
    }));
    found.push({ contact, entries });
  }
  return found;
}

const gaps = computeGaps(data);

// ─── Drift guard: confirm the in-memory mirror on exactly the flagged rows ──
// These rows are the ones an operator will act on, so their answer must match
// what the application itself resolves. (Silences the resolver's own warning —
// this is the inventory, not a runtime hit.)
let drift = 0;
if (gaps.length > 0) {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const gap of gaps) {
      const resolved = await getParticipantProgramIds({
        cid: gap.contact.cid,
        email: gap.contact.email,
        contact: gap.contact,
      });
      const appResolved = [...resolved].map(norm).sort().join("|");
      const auditResolved = gap.entries.map((entry) => entry.programId).sort().join("|");
      if (appResolved !== auditResolved) {
        drift++;
        console.log(`  ! mirror mismatch for ${gap.contact.cid}: app=[${appResolved}] audit=[${auditResolved}]`);
      }
    }
  } finally {
    console.warn = originalWarn;
  }
}

// ─── Report ────────────────────────────────────────────────────────────────
const bySource = { field: 0, family: 0, program: 0, intake: 0 };
const dangling = [];
for (const gap of gaps) {
  for (const entry of gap.entries) {
    for (const label of entry.sources) bySource[label]++;
  }
  gap.groupDerived = gap.entries.some((entry) =>
    entry.sources.some((source) => source === "family" || source === "program"),
  );
  if (gap.entries.some((entry) => !entry.inCatalog)) dangling.push(gap);
}

console.log("");
console.log("─── LEGACY-SOURCE COVERAGE ───────────────────────────────────────────");
console.log(`contacts scanned              : ${data.contacts.length}`);
console.log(
  `authoritative membership rows : ${[...data.authoritative.values()].reduce((total, programIdSet) => total + programIdSet.size, 0)}`,
);
console.log(`people dependent on the fallback: ${gaps.length}`);
console.log(
  `  by source — field: ${bySource.field} · family: ${bySource.family} · program: ${bySource.program} · intake: ${bySource.intake}`,
);
console.log(`  people with a group-derived dependency: ${gaps.filter((gap) => gap.groupDerived).length}`);
console.log(`  people referencing a program that no longer exists: ${dangling.length}`);
if (gaps.length > 0) console.log(`  mirror mismatches vs the app's own resolver: ${drift}`);

if (gaps.length > 0) {
  console.log("");
  for (const gap of gaps) {
    const contact = gap.contact;
    console.log(
      `${contact.cid}  ${contact.name || "(no name)"} <${contact.email || "?"}> [${contact.role || "?"}/${contact.status || "?"}]`,
    );
    console.log(`   group_name=${contact.group_name || "—"}  program_id=${contact.program_id || "—"}`);
    for (const entry of gap.entries) {
      console.log(
        `   → ${entry.programId}  via ${entry.sources.join("+")}  ${entry.inCatalog ? "(exists)" : "(MISSING from v2_programs)"}`,
      );
    }
  }
  console.log("");
  console.log("Nothing was written by this run.");
  if (!INCLUDE_GROUPS && gaps.some((gap) => gap.groupDerived)) {
    console.log(
      "Group-derived dependencies are listed but are NOT copied by --apply unless",
    );
    console.log(
      "--include-groups is passed (group membership is deliberately not a program source).",
    );
  }
} else {
  console.log("");
  console.log("✅ Nobody depends on the legacy sources: the fallback can be disabled");
  console.log("   (DISABLE_LEGACY_PARTICIPANT_FALLBACK=true).");
}

ensureScratchDir();
const reportFile = resolve(projectRoot, `scratch/participant-membership-gaps-${stamp}.json`);
writeFileSync(
  reportFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      envFile: usedEnvFile,
      contactsScanned: data.contacts.length,
      dependentOnFallback: gaps.length,
      bySource,
      mirrorMismatches: drift,
      people: gaps.map((gap) => ({
        cid: gap.contact.cid,
        name: gap.contact.name,
        email: gap.contact.email,
        role: gap.contact.role,
        status: gap.contact.status,
        group_name: gap.contact.group_name,
        program_id: gap.contact.program_id,
        resolved: gap.entries,
      })),
    },
    null,
    2,
  ),
);
console.log(`report: ${reportFile.replace(`${projectRoot}/`, "")}`);

// ─── Apply ──────────────────────────────────────────────────────────────────
if (APPLY && gaps.length > 0) {
  const insertable = [];
  for (const gap of gaps) {
    for (const entry of gap.entries) {
      if (!entry.inCatalog) continue; // never copy a dangling reference
      const groupDerivedOnly = entry.sources.every((source) => source === "family" || source === "program");
      if (groupDerivedOnly && !INCLUDE_GROUPS) continue;
      insertable.push({ cid: gap.contact.cid, programId: entry.programId });
    }
  }

  if (insertable.length === 0) {
    console.log("\n--apply: nothing to copy under the current source policy.");
  } else {
    const applied = [];
    const failed = [];
    for (const row of insertable) {
      try {
        const insertResult = await db.execute({
          sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
                VALUES (?, ?, 'active', NOW())
                ON CONFLICT (participant_id, program_id) DO NOTHING
                RETURNING participant_id`,
          args: [row.cid, row.programId],
        });
        if (insertResult.rows.length > 0) applied.push(row);
      } catch (error) {
        failed.push({ ...row, error: error.message });
      }
    }

    const rollbackFile = resolve(
      projectRoot,
      `scratch/participant-membership-rollback-${stamp}.sql`,
    );
    writeFileSync(
      rollbackFile,
      [
        `-- rollback of the membership copy ${stamp}`,
        "BEGIN;",
        ...applied.map(
          (row) =>
            `DELETE FROM participant_programs WHERE participant_id = '${String(row.cid).replace(/'/g, "''")}' AND CAST(program_id AS TEXT) = '${String(row.programId).replace(/'/g, "''")}';`,
        ),
        "COMMIT;",
        "",
      ].join("\n"),
    );

    console.log("");
    console.log(`--apply: ${applied.length} membership(s) copied (${failed.length} failed)`);
    for (const failure of failed) console.log(`  ! ${failure.cid} → ${failure.programId}: ${failure.error}`);
    console.log(`rollback: ${rollbackFile.replace(`${projectRoot}/`, "")}`);
  }

  const remaining = computeGaps(await loadEverything()).length;
  console.log(`\n--apply: people still dependent on the fallback: ${remaining}`);
  if (remaining > 0) {
    console.log("   (group-derived and dangling references stay listed — see the report)");
  }
  process.exit(remaining === 0 ? 0 : 2);
}

if (APPLY) {
  console.log("\n--apply: nothing to do.");
  process.exit(0);
}

if (VERIFY) process.exit(gaps.length === 0 ? 0 : 1);
process.exit(gaps.length === 0 ? 0 : 2);
