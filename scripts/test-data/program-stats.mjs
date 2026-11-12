#!/usr/bin/env node
/**
 * Test data for the PROGRAM statistics — STAGING ONLY.
 *
 *   node scripts/test-data/program-stats.mjs seed      # (re)create everything
 *   node scripts/test-data/program-stats.mjs cleanup   # remove everything
 *
 * Creates one program, 4 weekly sessions, 4 deliverables, 10 participants with
 * a planned mix of attendance and submissions, and one test program manager
 * (a `staff` account set as the program's PM — the app grants its PM profile
 * itself at first sign-in, as for a real PM). Everything it writes is tagged:
 * contacts `TEST_STATS_*` (emails @test.impactos.local) and the program
 * `TEST_PROGRAM_ID`. `seed` cleans up first, so it can be re-run.
 *
 * `cleanup` removes every row, in every table, that names a TEST_STATS_ person
 * or the test program — including what the app itself wrote while the test
 * accounts were used (grants, notifications, reviews, attendance…).
 *
 * Refuses to run unless DATABASE_URL in .env.local is the staging project.
 * Test accounts sign in with TEST_PASSWORD.
 */

import fs from "node:fs";
import pg from "pg";
import bcrypt from "bcryptjs";

const STAGING_REF = "mbpaxrfhqqclzyiefuab";
const TEST_PROGRAM_ID = "00000000-7e57-4000-8000-000000000001";
const CID_PREFIX = "TEST_STATS_";
const TEST_PASSWORD = "Test.123456";

const WEEKS = [
  { week: 1, date: "2026-10-20", due: "2026-10-24", status: "completed" },
  { week: 2, date: "2026-10-27", due: "2026-10-31", status: "completed" },
  { week: 3, date: "2026-11-03", due: "2026-11-07", status: "not started" },
  { week: 4, date: "2026-11-10", due: "2026-11-14", status: "not started" },
];

// Weeks each participant attended (weeks 1–3 have happened; the rest are absent).
const ATTENDED = {
  1: [1, 2, 3], 2: [1, 2, 3], 3: [1, 2, 3], 4: [1, 2, 3],
  5: [1, 2], 6: [1, 2], 7: [1, 2],
  8: [1], 9: [1],
  10: [],
};

// Submissions per week: participant number → status.
const SUBMISSIONS = {
  1: { 1: "approved", 2: "approved", 3: "approved", 4: "approved", 5: "approved", 6: "approved", 7: "pending", 8: "rejected" },
  2: { 1: "approved", 2: "approved", 3: "approved", 4: "pending", 5: "pending" },
  3: { 1: "approved" },
};

const cidOf = (n) => `${CID_PREFIX}P${String(n).padStart(2, "0")}`;
const PM_CID = `${CID_PREFIX}PM`;
const PERSON_COLUMNS = [
  "participant_id", "contact_cid", "user_cid", "recipient_id", "actor_cid",
  "target_cid", "submitter_id", "staff_id", "teacher_id", "created_by",
];

function stagingClient() {
  const line = fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .find((entry) => entry.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  const url = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  if (!url.includes(`postgres.${STAGING_REF}`)) {
    throw new Error("Refusing to run: .env.local is not the staging database.");
  }
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return new pg.Client({ connectionString: parsed.toString(), ssl: { rejectUnauthorized: false } });
}

async function cleanup(client) {
  const tagged = `${CID_PREFIX}%`;
  const { rows } = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name NOT IN ('contacts', 'v2_programs')
        AND (column_name = ANY($1) OR column_name = 'program_id')`,
    [PERSON_COLUMNS],
  );
  const targets = rows.map(({ table_name: table, column_name: column }) =>
    column === "program_id"
      ? { table, sql: `DELETE FROM "${table}" WHERE "${column}"::text = $1`, args: [TEST_PROGRAM_ID] }
      : { table, sql: `DELETE FROM "${table}" WHERE "${column}"::text LIKE $1`, args: [tagged] },
  );
  // Foreign keys decide the order; retry what a reference blocked until nothing moves.
  let pending = targets;
  for (let pass = 0; pass < 6 && pending.length > 0; pass += 1) {
    const blocked = [];
    for (const target of pending) {
      await client.query("SAVEPOINT step");
      try {
        const result = await client.query(target.sql, target.args);
        await client.query("RELEASE SAVEPOINT step");
        if (result.rowCount) console.log(`  removed ${result.rowCount} from ${target.table}`);
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT step");
        blocked.push({ ...target, error: error.message });
      }
    }
    if (blocked.length === pending.length) {
      throw new Error(`cleanup blocked: ${blocked.map((entry) => `${entry.table}: ${entry.error}`).join("; ")}`);
    }
    pending = blocked;
  }
  const program = await client.query("DELETE FROM v2_programs WHERE id::text = $1", [TEST_PROGRAM_ID]);
  if (program.rowCount) console.log("  removed the test program");
  const people = await client.query("DELETE FROM contacts WHERE cid LIKE $1", [tagged]);
  if (people.rowCount) console.log(`  removed ${people.rowCount} test contacts`);
}

async function seed(client) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  await client.query(
    `INSERT INTO contacts (cid, name, email, role, status, password, language, created_at)
     VALUES ($1, 'Test Stats PM', 'test-stats-pm@test.impactos.local', 'staff', 'active', $2, 'fr', NOW())`,
    [PM_CID, passwordHash],
  );
  await client.query(
    `INSERT INTO v2_programs (id, name, description, duration_weeks, start_date, end_date, status, program_type, assigned_pm_id, created_at, updated_at)
     VALUES ($1, 'TEST — Statistiques programme', 'Données de test (scripts/test-data/program-stats.mjs). À supprimer avec la commande cleanup.',
             4, '2026-10-19', '2026-11-15', 'active', 'incubation', $2, NOW(), NOW())`,
    [TEST_PROGRAM_ID, PM_CID],
  );

  const deliverableByWeek = {};
  const sessionByWeek = {};
  for (const { week, date, due, status } of WEEKS) {
    const session = await client.query(
      `INSERT INTO v2_sessions (program_id, week_number, type, title, status, scheduled_date, start_at, created_at)
       VALUES ($1, $2, 'session', $3, $4, $5, ($5 || ' 10:00:00+01')::timestamptz, NOW()) RETURNING id`,
      [TEST_PROGRAM_ID, week, `TEST Session semaine ${week}`, status, date],
    );
    sessionByWeek[week] = session.rows[0].id;
    const requirement = await client.query(
      `INSERT INTO v2_document_requirements (program_id, title, is_completed, session_id, due_date, assignee_type, created_at)
       VALUES ($1, $2, 0, $3, $4, 'all', NOW()) RETURNING id`,
      [TEST_PROGRAM_ID, `TEST Livrable semaine ${week}`, String(session.rows[0].id), due],
    );
    deliverableByWeek[week] = requirement.rows[0].id;
  }

  for (let n = 1; n <= 10; n += 1) {
    const cid = cidOf(n);
    await client.query(
      `INSERT INTO contacts (cid, name, email, role, status, password, language, created_at)
       VALUES ($1, $2, $3, 'member', 'active', $4, 'fr', NOW())`,
      [cid, `Test Stats ${String(n).padStart(2, "0")}`, `test-stats-${String(n).padStart(2, "0")}@test.impactos.local`, passwordHash],
    );
    await client.query(
      `INSERT INTO participant_programs (participant_id, program_id, enrolled_at, accepted_at, status, source)
       VALUES ($1, $2, '2026-10-19', '2026-10-19', 'active', 'test-data')`,
      [cid, TEST_PROGRAM_ID],
    );
    for (const { week, date } of WEEKS.filter((entry) => entry.week <= 3)) {
      await client.query(
        `INSERT INTO v2_attendance (session_id, program_id, participant_id, status, date, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [String(sessionByWeek[week]), TEST_PROGRAM_ID, cid, ATTENDED[n].includes(week) ? "present" : "absent", date],
      );
    }
  }

  for (const [week, byParticipant] of Object.entries(SUBMISSIONS)) {
    for (const [n, status] of Object.entries(byParticipant)) {
      const deliverableId = deliverableByWeek[week];
      await client.query(
        `INSERT INTO v2_submissions (program_id, participant_id, deliverable_id, document_id, file_url, status, approved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'https://example.com/test-livrable.pdf', $5, $6, NOW(), NOW())`,
        [TEST_PROGRAM_ID, cidOf(Number(n)), String(deliverableId), deliverableId, status, status === "approved" ? new Date() : null],
      );
    }
  }
}

const command = process.argv[2];
if (!["seed", "cleanup"].includes(command)) {
  console.error("Usage: node scripts/test-data/program-stats.mjs seed|cleanup");
  process.exit(1);
}

const client = stagingClient();
await client.connect();
try {
  await client.query("BEGIN");
  console.log("cleanup…");
  await cleanup(client);
  if (command === "seed") {
    console.log("seed…");
    await seed(client);
  }
  await client.query("COMMIT");
  console.log(
    command === "seed"
      ? `done — 10 participants + 1 PM (test-stats-pm@test.impactos.local), password ${TEST_PASSWORD}`
      : "done",
  );
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Rolled back:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
