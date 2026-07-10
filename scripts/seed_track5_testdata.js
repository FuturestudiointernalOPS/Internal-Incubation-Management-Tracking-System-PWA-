const { Pool } = require("pg");
const fs = require("fs");
const url = fs
  .readFileSync(".env.local", "utf8")
  .match(/DATABASE_URL=(.+)/)[1]
  .trim();
const p = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const prog = "92e91858-b6f3-4836-b3ca-c8703c5ec749";

  // 1. Completion records
  await p.query(
    `INSERT INTO program_completion_records (program_id, participant_id, participant_name, completion_status, deliverables_completed, deliverables_total, attendance_rate) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (program_id, participant_id) DO UPDATE SET completion_status = EXCLUDED.completion_status`,
    [prog, "USR-79PVCKB9", "Alice Dev", "graduated", 8, 10, 85],
  );
  console.log("Record 1 ✓");
  await p.query(
    `INSERT INTO program_completion_records (program_id, participant_id, participant_name, completion_status, deliverables_completed, deliverables_total, attendance_rate) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (program_id, participant_id) DO UPDATE SET completion_status = EXCLUDED.completion_status`,
    [prog, "USR-3PZ54QBK", "Bob Designer", "completed", 6, 10, 72],
  );
  console.log("Record 2 ✓");
  await p.query(
    `INSERT INTO program_completion_records (program_id, participant_id, participant_name, completion_status, deliverables_completed, deliverables_total, attendance_rate) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (program_id, participant_id) DO UPDATE SET completion_status = EXCLUDED.completion_status`,
    [prog, "USR-LBEZPB79", "Carol PM", "incomplete", 4, 10, 55],
  );
  console.log("Record 3 ✓");

  // 2. Venture recommendation (team_id = 1, doesn't need real team)
  await p.query(
    `INSERT INTO venture_recommendations (program_id, team_id, team_name, recommended_by, recommended_by_name, reason, status) VALUES ($1, 1, 'Alpha Team', 'USR-PPBUPEM6', 'Staff Two', 'Strong MVP progress, investment-ready within 3 months', 'pending')`,
    [prog],
  );
  await p.query(
    `INSERT INTO venture_recommendations (program_id, team_id, team_name, recommended_by, recommended_by_name, reason, status) VALUES ($1, 2, 'Beta Squad', 'USR-PPBUPEM6', 'Staff Two', 'Excellent market traction, recommend fast-track', 'approved')`,
    [prog],
  );
  await p.query(
    `INSERT INTO venture_recommendations (program_id, team_id, team_name, recommended_by, recommended_by_name, reason, status, reviewed_by, reviewed_by_name, reviewed_at) VALUES ($1, 3, 'Gamma Group', 'USR-PPBUPEM6', 'Staff Two', 'Needs more product development', 'rejected', 'sa', 'Super Admin', NOW())`,
    [prog],
  );
  console.log("Venture ✓");

  // 3. Alumni records
  await p.query(
    `INSERT INTO alumni_records (participant_id, participant_name, participant_email, graduated_program_id, graduated_program_name, status) VALUES ($1, 'Alice Dev', 'alice@impactos.test', $2, 'Live Test Program', 'active') ON CONFLICT (participant_id) DO UPDATE SET status = EXCLUDED.status`,
    ["USR-79PVCKB9", prog],
  );
  await p.query(
    `INSERT INTO alumni_records (participant_id, participant_name, participant_email, graduated_program_id, graduated_program_name, status) VALUES ($1, 'Bob Designer', 'bob@impactos.test', $2, 'Live Test Program', 'engaged') ON CONFLICT (participant_id) DO UPDATE SET status = EXCLUDED.status`,
    ["USR-3PZ54QBK", prog],
  );
  console.log("Alumni ✓");

  await p.end();
  console.log("All test data created!");
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
