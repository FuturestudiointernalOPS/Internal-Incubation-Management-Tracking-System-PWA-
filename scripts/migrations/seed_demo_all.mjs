/**
 * LEGACY NOTE (participant cleanup): this demo seed still writes v2_participants.
 * Offline demo tool only; switch to participant_programs or retire before
 * v2_participants removal.
 */
import db, { initDb } from "../src/lib/db.js";
import fs from "fs";
import path from "path";

// Auto-load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * SEED SCRIPT: Populate program tracking demo data
 *
 * Creates 1 program, 5 participants, sessions, submissions, attendance.
 * All linked together so dashboards show realistic data.
 *
 * Run: set -a && . .env.local && node scripts/seed_demo_all.mjs
 */

const PROG_ID = "P-2026-DEMO";
const PROG_NAME = "Digital Skills Accelerator";

const STAFF = [
  {
    cid: "DEMO-S1",
    name: "Sarah Chen",
    email: "sarah@futurestudio.com",
    role: "teacher",
  },
  {
    cid: "DEMO-S2",
    name: "Mike Okafor",
    email: "mike@futurestudio.com",
    role: "teacher",
  },
];

const PARTICIPANTS = [
  {
    cid: "CID-1001",
    name: "Alex Rivera",
    email: "alex@demo.com",
    group: "Alpha Cohort",
  },
  {
    cid: "CID-1002",
    name: "Fatima Al-Hassan",
    email: "fatima@demo.com",
    group: "Alpha Cohort",
  },
  {
    cid: "CID-1003",
    name: "Kofi Mensah",
    email: "kofi@demo.com",
    group: "Alpha Cohort",
  },
  {
    cid: "CID-1004",
    name: "Lena Schmidt",
    email: "lena@demo.com",
    group: "Beta Cohort",
  },
  {
    cid: "CID-1005",
    name: "Carlos Mendez",
    email: "carlos@demo.com",
    group: "Beta Cohort",
  },
];

const WEEK_TOPICS = [
  "Introduction & Setup",
  "HTML & CSS Fundamentals",
  "JavaScript Basics",
  "Building Your First App",
];

const SUBMISSION_TYPES = [
  { title: "Week 1 Reflection Essay", format: "pdf" },
  { title: "HTML Portfolio Page", format: "link" },
  { title: "JavaScript Calculator", format: "link" },
  { title: "Final Project Proposal", format: "pdf" },
];

const STUDENT_WORK = [
  [
    "Reflection on digital literacy journey",
    "https://gist.github.com/demo/alex-w1",
  ],
  [
    "Understanding the command line basics",
    "https://gist.github.com/demo/fatima-w1",
  ],
  ["My first week learning experience", "https://gist.github.com/demo/kofi-w1"],
  ["HTML page with personal portfolio", "https://gist.github.com/demo/lena-w2"],
  [
    "JS calculator with basic operations",
    "https://gist.github.com/demo/carlos-w3",
  ],
];

async function seed() {
  await initDb();
  console.log("Seeding program tracking demo data...\n");

  // 1. Insert Contacts (staff + participants)
  console.log("[1/6] Contacts...");
  for (const staffMember of STAFF) {
    try {
      await db.execute({
        sql: "INSERT INTO contacts (cid, name, email, role, group_name, status, deleted) VALUES (?, ?, ?, ?, ?, 'approved', 0)",
        args: [staffMember.cid, staffMember.name, staffMember.email, staffMember.role, "Future Studio"],
      });
    } catch {
      /* ignore duplicates */
    }
  }
  for (const participant of PARTICIPANTS) {
    try {
      await db.execute({
        sql: "INSERT INTO contacts (cid, name, email, role, group_name, status, program_id, program_name, deleted) VALUES (?, ?, ?, 'participant', ?, 'approved', ?, ?, 0)",
        args: [participant.cid, participant.name, participant.email, participant.group, PROG_ID, PROG_NAME],
      });
    } catch {
      /* ignore */
    }
  }
  console.log(`  ✅ ${STAFF.length + PARTICIPANTS.length} contacts`);

  // 2. Insert Program
  console.log("[2/6] Program...");
  try {
    await db.execute({
      sql: "INSERT INTO v2_programs (id, name, description, duration_weeks, status, is_archived, materials, start_date, end_date) VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?)",
      args: [
        PROG_ID,
        PROG_NAME,
        "A 4-week accelerated digital skills program for early-career professionals.",
        4,
        JSON.stringify([]),
        "2026-05-04",
        "2026-05-29",
      ],
    });
    console.log(`  ✅ Program: ${PROG_NAME}`);
  } catch (error) {
    console.log(`  ⚠️  Program: ${error.message}`);
  }

  // 3. Insert Participants (v2_participants)
  console.log("[3/6] Participants enrollment...");
  for (const participant of PARTICIPANTS) {
    try {
      await db.execute({
        sql: "INSERT INTO v2_participants (program_id, name, email, phone, screening_status) VALUES (?, ?, ?, ?, 'approved')",
        args: [PROG_ID, participant.name, participant.email, "+2335000000"],
      });
    } catch {
      /* ignore */
    }
  }
  console.log(`  ✅ ${PARTICIPANTS.length} participants`);

  // 4. Insert Sessions (weekly)
  console.log("[4/6] Sessions...");
  for (let week = 1; week <= 4; week++) {
    const sesId = `SES-${PROG_ID}-W${week}`;
    const startDate = new Date(2026, 4, 4 + (week - 1) * 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2);

    try {
      await db.execute({
        sql: "INSERT INTO v2_sessions (id, program_id, week_number, title, status, scheduled_date, end_date, handler_id, handler_name, materials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          sesId,
          PROG_ID,
          week,
          WEEK_TOPICS[week - 1],
          week <= 3 ? "completed" : "in progress",
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0],
          week % 2 === 0 ? STAFF[0].cid : STAFF[1].cid,
          week % 2 === 0 ? STAFF[0].name : STAFF[1].name,
          JSON.stringify([{ name: `Week ${week} slides`, type: "link" }]),
        ],
      });
    } catch (error) {
      console.log(`  ⚠️  Session W${week}: ${error.message}`);
    }
  }
  console.log(`  ✅ 4 sessions`);

  // 5. Insert Document Requirements + Submissions
  console.log("[5/6] Requirements & Submissions...");
  for (let week = 1; week <= 4; week++) {
    const reqId = `REQ-${PROG_ID}-W${week}`;
    const sesId = `SES-${PROG_ID}-W${week}`;
    try {
      await db.execute({
        sql: "INSERT INTO v2_document_requirements (id, program_id, session_id, title, allowed_format, is_completed) VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          reqId,
          PROG_ID,
          sesId,
          SUBMISSION_TYPES[week - 1].title,
          SUBMISSION_TYPES[week - 1].format,
          week <= 3 ? 1 : 0,
        ],
      });
    } catch {
      /* ignore */
    }

    // Submissions per participant for completed weeks
    if (week <= 3) {
      for (const participant of PARTICIPANTS) {
        const score = Math.floor(Math.random() * 30) + 65; // 65-95
        try {
          await db.execute({
            sql: "INSERT INTO v2_submissions (program_id, participant_id, document_id, file_url, status, score, deliverable_title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            args: [
              PROG_ID,
              participant.cid,
              reqId,
              STUDENT_WORK[(week + PARTICIPANTS.indexOf(participant)) % STUDENT_WORK.length],
              score >= 70 ? "approved" : "pending",
              score,
              SUBMISSION_TYPES[week - 1].title,
              new Date(
                2026,
                4,
                6 + (week - 1) * 7 + PARTICIPANTS.indexOf(participant),
              ).toISOString(),
            ],
          });
        } catch {
          /* ignore */
        }
      }
    }
  }
  console.log(`  ✅ Requirements + submissions`);

  // 6. Insert PM Weekly Reports (v2_weekly_reports) with blockers + issues
  console.log("[6/7] PM Weekly Reports...");
  const PM_SUMMARIES = [
    "Strong start. Students engaged and asking good questions. No major blockers.",
    "Week went well. Some students struggling with CSS layout concepts. Provided extra resources.",
    "Good progress. Most students completed the JS exercises. Two students needed extra help with loops.",
    "Final week wrapping up. Students excited about final projects. Need to ensure all submissions are in.",
  ];
  const PM_BLOCKERS = [
    null,
    "Projector not working in session 2, had to improvise with whiteboard",
    "Some students falling behind due to busy work schedules",
    "Pending graduation certificates from admin",
  ];
  const ISSUE_TYPES = [
    [],
    ["technical"],
    ["attendance", "participation"],
    ["curriculum"],
  ];

  for (let week = 1; week <= 4; week++) {
    const weekStatus = week <= 3 ? "successful" : "partially_completed";
    const weekRating = week <= 3 ? "good" : "fair";
    try {
      await db.execute({
        sql: `INSERT INTO v2_weekly_reports
          (program_id, week_number, teacher_id, teacher_name, progress_notes, reception_score,
           week_status, week_rating, main_topic,
           attendance_level, participation_level,
           participants_need_attention, participants_attention_notes,
           delivery_quality, participant_understanding,
           delivery_challenges, delivery_challenge_note,
           had_issues, issue_types, requires_admin_attention, additional_issue_note,
           program_on_track, planned_adjustments)
          VALUES (?, ?, ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?,
           ?, ?,
           ?, ?,
           ?, ?,
           ?, ?, ?, ?,
           ?, ?)`,
        args: [
          PROG_ID,
          week,
          "PM-001",
          "Program Manager",
          PM_SUMMARIES[week - 1],
          week <= 3 ? 7 : 4,
          weekStatus,
          weekRating,
          WEEK_TOPICS[week - 1],
          week <= 3 ? "high" : "moderate",
          week <= 2 ? "very_active" : week === 3 ? "active" : "passive",
          week === 3 ? 1 : 0,
          week === 3
            ? "2 students falling behind, offering catch-up sessions"
            : null,
          weekRating,
          week <= 3 ? "high" : "moderate",
          week === 2 ? 1 : 0,
          PM_BLOCKERS[week - 1],
          week === 4 ? 1 : 0,
          JSON.stringify(ISSUE_TYPES[week - 1]),
          week === 4 ? 1 : 0,
          week === 4 ? "Need certificates prepared for Friday" : null,
          week <= 3 ? 1 : 0,
          week === 4
            ? "Expedite certificate processing, follow up with admin"
            : null,
        ],
      });
    } catch (error) {
      console.log(`  ⚠️  PM Report W${week}: ${error.message}`);
    }
  }
  console.log(`  ✅ 4 PM weekly reports with blockers & issues`);

  // 7. Insert Attendance
  console.log("[6/6] Attendance...");
  for (let week = 1; week <= 4; week++) {
    const sesId = `SES-${PROG_ID}-W${week}`;
    for (const participant of PARTICIPANTS) {
      const statuses = [
        "present",
        "present",
        "present",
        "present",
        "absent",
        "late",
        "excused",
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      try {
        await db.execute({
          sql: "INSERT INTO v2_attendance (session_id, program_id, participant_id, status, date) VALUES (?, ?, ?, ?, ?)",
          args: [
            sesId,
            PROG_ID,
            participant.cid,
            status,
            new Date(2026, 4, 5 + (week - 1) * 7).toISOString().split("T")[0],
          ],
        });
      } catch {
        /* ignore */
      }
    }
  }
  console.log(`  ✅ ${PARTICIPANTS.length * 4} attendance records`);
  console.log("\n✅ Demo seed complete!");
  console.log("   View at:");
  console.log("   - /admin (dashboard)");
  console.log("   - /admin/programs (program list)");
  console.log("   - /admin/programs/" + PROG_ID + " (program detail)");
  console.log("   - /participant?email=alex@demo.com (participant view)");
}

seed().then(() => process.exit(0));
