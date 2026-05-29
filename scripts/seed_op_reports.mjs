import db, { initDb } from "../src/lib/db.js";

/**
 * SEED SCRIPT: Populate v2_op_reports with demo data
 *
 * Creates 3 staff members with stand-up and retro reports
 * across the last 6 weeks to populate the dashboards.
 *
 * Run: set -a && . .env.local && node scripts/seed_op_reports.mjs
 */

const STAFF = [
  { id: "DEMO-001", name: "Sarah Chen", role: "staff" },
  { id: "DEMO-002", name: "Mike Okafor", role: "staff" },
  { id: "DEMO-003", name: "Amara Diallo", role: "teacher" },
  { id: "DEMO-004", name: "James Li", role: "staff" },
  { id: "DEMO-005", name: "Priya Sharma", role: "staff" },
];

const TOP_PRIORITIES = [
  ["Finalize Q2 marketing strategy", "Complete competitor analysis", "Prepare board deck"],
  ["Deploy API v2 to staging", "Fix auth flow bugs", "Write integration tests"],
  ["Grade participant submissions", "Prepare week 6 curriculum", "Schedule 1:1 reviews"],
  ["Redesign landing page", "Optimize mobile layout", "Create style guide"],
  ["Onboard new team members", "Update documentation", "Setup CI/CD pipeline"],
];

const DELIVERABLES = [
  ["Marketing strategy doc", "Competitor comparison spreadsheet", "Board presentation"],
  ["API v2 staging deploy", "Auth bug fix PR", "Integration test suite"],
  ["Submission feedback forms", "Week 6 slide deck", "Review schedule calendar"],
  ["Landing page mockups", "Mobile responsive components", "Style guide PDF"],
  ["Onboarding checklist", "Wiki updates", "Pipeline YAML config"],
];

const COMPLETED = [
  ["Q2 strategy draft", "Met with design team", "Reviewed analytics"],
  ["API endpoints refactored", "Database migration completed", "PR merged for auth fix"],
  ["All submissions graded", "Week 5 feedback sent", "Team sync completed"],
  ["Homepage redesigned", "Color palette finalized", "Typography system done"],
  ["Docs migrated to new format", "CI pipeline green", "Two new members onboarded"],
];

const WINS = [
  ["Team collaboration improved significantly", "Client loved the new direction"],
  ["Zero bugs in production deploy", "Test coverage reached 85%"],
  ["Students gave great feedback", "Attendance was 95% this week"],
  ["Design system approved by stakeholders", "Mobile traffic up 20%"],
  ["Smooth onboarding process", "Build time reduced by 40%"],
];

const CHALLENGES = [
  ["Cross-team communication delays", "Shifting priorities mid-week"],
  ["Unexpected dependency on legacy system", "Environment configuration issues"],
  ["Some students falling behind", "Limited time for 1:1s"],
  ["Feedback loop too slow with engineering", "Design review bottlenecks"],
  ["Documentation gaps in existing codebase", "Tooling setup took longer than expected"],
];

const BLOCKERS = ["Waiting on legal review", "AWS credit limit reached", "Pending vendor approval", "", ""];

const blockTypes = ["Technical", "Communication", "Dependency", "Time Constraint", "Resource Limitation"];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomBool(weight = 0.3) { return Math.random() < weight; }

async function seed() {
  await initDb();
  console.log("Seeding v2_op_reports with demo data...\n");

  const now = new Date();
  let total = 0;

  for (let weekOffset = 5; weekOffset >= 0; weekOffset--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - weekOffset * 7);
    const weekNum = getWeekNumber(weekDate);
    const year = weekDate.getFullYear();

    for (const staff of STAFF) {
      const idx = STAFF.indexOf(staff);

      // Monday Stand-Up
      const hasBlocker = randomBool(0.35);
      const blockerDesc = hasBlocker ? randomItem(BLOCKERS) : null;

      try {
        await db.execute({
          sql: `INSERT OR REPLACE INTO v2_op_reports
            (user_id, user_name, user_role, report_type, week_number, year, status, created_at,
             top_priorities, expected_deliverables, projects_tasks,
             has_dependencies, dependency_note, has_blockers, blocker_description,
             needs_support, support_note, additional_notes)
            VALUES (?, ?, ?, 'standup', ?, ?, 'submitted', ?,
             ?, ?, ?,
             ?, ?, ?, ?,
             ?, ?, ?)`,
          args: [
            staff.id, staff.name, staff.role,
            weekNum, year,
            new Date(weekDate.getTime() + 9 * 3600000 + idx * 1800000).toISOString(),
            JSON.stringify(TOP_PRIORITIES[idx]),
            JSON.stringify(DELIVERABLES[idx]),
            randomItem(["Website redesign project", "API integration work", "Curriculum development", "Mobile app v2", "Team onboarding"]),
            randomBool() ? 1 : 0,
            randomBool() ? randomItem(["Waiting on design handoff", "Needs stakeholder approval", "Pending code review"]) : null,
            hasBlocker ? 1 : 0,
            blockerDesc || null,
            randomBool() ? 1 : 0,
            randomBool() ? randomItem(["Need access to analytics tool", "Could use help with testing", "Need extra review time"]) : null,
            randomBool() ? randomItem(["Mentioned in standup: progressing well", "Had a great sync with design team", "Blocked but working on workaround"]) : null,
          ],
        });
        total++;
      } catch (e) {
        console.log(`  ⚠️  Stand-up W${weekNum} ${staff.name}: ${e.message}`);
      }

      // Friday Retro
      const hadBlocker = randomBool(0.25);
      const blockerType = hadBlocker ? randomItem(blockTypes) : null;

      try {
        await db.execute({
          sql: `INSERT OR REPLACE INTO v2_op_reports
            (user_id, user_name, user_role, report_type, week_number, year, status, created_at,
             completed_work, unfinished_tasks, week_status,
             had_blockers, blocker_type, blocker_desc,
             wins, major_achievement, carryover_items, retro_notes)
            VALUES (?, ?, ?, 'retro', ?, ?, 'submitted', ?,
             ?, ?, ?,
             ?, ?, ?,
             ?, ?, ?, ?)`,
          args: [
            staff.id, staff.name, staff.role,
            weekNum, year,
            new Date(weekDate.getTime() + 33 * 3600000 + idx * 1800000).toISOString(),
            JSON.stringify(COMPLETED[idx]),
            JSON.stringify(randomItem([["CSS cleanup", "Minor bug fixes"], ["Code review PRs", "Draft documentation"], ["", ""]])),
            randomItem(["successful", "partially_successful", "successful", "successful"]),
            hadBlocker ? 1 : 0,
            blockerType,
            hadBlocker ? randomItem(BLOCKERS) : null,
            JSON.stringify(WINS[idx]),
            randomItem(["Hit all milestones", "Exceeded weekly targets", "Great team collaboration", ""]),
            JSON.stringify(randomItem([["QA review pending", "Deploy to production"], ["Documentation updates", "", ""]])),
            randomBool() ? randomItem(["Good week overall", "Need to improve planning", "Team morale is high"]) : null,
          ],
        });
        total++;
      } catch (e) {
        console.log(`  ⚠️  Retro W${weekNum} ${staff.name}: ${e.message}`);
      }
    }
  }

  console.log(`  ✅ Inserted ${total} demo reports across ${STAFF.length} staff members`);
  console.log(`     (${STAFF.length * 6} stand-ups + ${STAFF.length * 6} retros over 6 weeks)`);
  console.log("\n✅ Seed complete.");
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

seed().then(() => process.exit(0));
