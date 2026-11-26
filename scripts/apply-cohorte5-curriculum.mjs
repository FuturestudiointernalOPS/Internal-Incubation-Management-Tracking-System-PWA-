/**
 * ONE-OFF — curriculum for "Programme Incubation Cohorte 5" (3 weeks).
 *
 * Inserts the three curriculum sessions of the cohort, their system Attendance
 * requirement and their deliverable, using the SAME statements as
 * `src/models/curriculum/sessionsAndSelfHealing/sessionCreation.js` and the same
 * shape as the `add_session` action of `src/services/programs/curriculumActions.js`
 * (status "not started", type "session", weight 1, attendance row per session).
 * It then rewrites the `kpi_progress` cache the way `recalculateKpiProgress` does.
 *
 * SAFETY
 *   - Reads DATABASE_URL from .env.local (staging). The value is never printed.
 *   - Refuses to write when the program already has any session, so re-running
 *     the script cannot duplicate the curriculum.
 *   - Writes inside one transaction: either all three sessions exist, or none.
 *   - `--dry-run` prints the plan and touches nothing.
 *
 * Run: node scripts/apply-cohorte5-curriculum.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = process.env.ENV_FILE || ".env.local";
const DRY_RUN = process.argv.includes("--dry-run");

const PROGRAM_ID = "c6fa462a-f621-4a72-b0e9-8634e3ffdecb";
const TIMEZONE = "Africa/Porto-Novo";

// KPI ids of this program (v2_kpis) — see the audit output.
const KPI = {
  attendance: 7, // Attendance Rate
  assignment: 8, // Assignment Completion
  participation: 9, // Session Participation
  engagement: 10, // Team Engagement
  coaching: 11, // Coaching Completion
  graduation: 12, // Graduation Rate
};

const TEAM = {
  pm: { id: "USR_58C499684A4B", name: "Joakh" },
  assistant: { id: "USR_2342F36BA5F0", name: "Aïchath" },
};

/** The three sessions, one per program week (2 → 23 Nov 2026). */
const SESSIONS = [
  {
    title: "Lancement & cadrage de la cohorte",
    week: 1,
    date: "2026-11-03",
    start: "09:00",
    end: "12:00",
    handler: TEAM.pm,
    kpis: [KPI.participation],
    description:
      "Accueil de la cohorte, cadre du programme et contrat pédagogique. Chaque équipe repart avec trois objectifs mesurables pour les trois semaines.",
    notes:
      "09h00 accueil · 09h30 cadre et attentes · 10h15 ateliers objectifs · 11h30 questions/réponses. Apporter un ordinateur portable.",
    materials: [
      {
        type: "link",
        name: "Dossier de la cohorte 5",
        content: "https://drive.google.com/drive/folders/cohorte-5",
      },
      {
        type: "text",
        name: "Agenda de la séance",
        content:
          "09h00 accueil · 09h30 cadre et attentes · 10h15 ateliers objectifs · 11h30 questions/réponses",
      },
    ],
    deliverable: {
      title: "Fiche d'objectifs personnels",
      description:
        "Une page : trois objectifs pour les trois semaines, un indicateur mesurable par objectif, un risque identifié.",
      format: "pdf",
      due: "2026-11-06",
      kpis: [KPI.assignment],
    },
  },
  {
    title: "Modèle économique & proposition de valeur",
    week: 2,
    date: "2026-11-10",
    start: "09:00",
    end: "12:00",
    handler: TEAM.assistant,
    kpis: [KPI.assignment],
    description:
      "Formaliser la proposition de valeur, le segment client et le chiffrage du modèle économique. Revue croisée des canevas par les pairs.",
    notes:
      "09h00 restitution des entretiens clients · 09h45 atelier Business Model Canvas · 11h00 chiffrage et tarification · 11h40 revue croisée.",
    materials: [
      {
        type: "text",
        name: "Support atelier",
        content:
          "Business Model Canvas vierge + grille de chiffrage à remplir en séance.",
      },
    ],
    deliverable: {
      title: "Business Model Canvas chiffré",
      description:
        "Canevas complet avec coûts, revenus et prix cible. Une hypothèse de revenu doit être chiffrée, pas qualitative.",
      format: "pdf",
      due: "2026-11-13",
      kpis: [KPI.assignment],
    },
  },
  {
    title: "Demo Day & jury de sortie",
    week: 3,
    date: "2026-11-17",
    start: "14:00",
    end: "17:00",
    handler: TEAM.pm,
    kpis: [KPI.graduation],
    description:
      "Pitch final devant le jury, démonstration du produit et décision de sortie de programme pour chaque équipe.",
    notes:
      "14h00 pitchs (8 min + 7 min de questions) · 16h15 délibération du jury · 16h45 annonce des résultats et prochaines étapes.",
    materials: [
      {
        type: "text",
        name: "Déroulé du Demo Day",
        content:
          "14h00 pitchs (8 min + 7 min de questions) · 16h15 délibération · 16h45 annonce.",
      },
    ],
    deliverable: {
      title: "Pitch final et démonstration",
      description:
        "Vidéo du pitch (5 minutes maximum) accompagnée de la démonstration live du produit.",
      format: "video",
      due: "2026-11-20",
      kpis: [KPI.graduation],
    },
  },
];

const KPI_TITLES = {
  [KPI.attendance]: "Attendance Rate",
  [KPI.assignment]: "Assignment Completion",
  [KPI.participation]: "Session Participation",
  [KPI.engagement]: "Team Engagement",
  [KPI.coaching]: "Coaching Completion",
  [KPI.graduation]: "Graduation Rate",
};

const readDatabaseUrl = (file) => {
  const raw = readFileSync(path.resolve(PROJECT_ROOT, file), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
};

const databaseUrl = readDatabaseUrl(ENV_FILE);
if (!databaseUrl) {
  console.error(`Missing DATABASE_URL in ${ENV_FILE}`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: /sslmode=/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();
await client.query("SET statement_timeout = '60s'");

const who = await client.query("SELECT current_database() AS db, current_user AS usr");
// The pooler user carries the project ref (postgres.<ref>); the password is
// never read, so the target database can be confirmed without leaking anything.
const projectRef = (() => {
  try {
    return new URL(databaseUrl).username;
  } catch {
    return "?";
  }
})();
console.log(
  `\n=== CONNECTED: ${who.rows[0].db} as ${who.rows[0].usr} · ${projectRef} (env: ${ENV_FILE}) ===\n`,
);

const programRes = await client.query(
  "SELECT id, name, start_date, end_date, duration_weeks FROM v2_programs WHERE id::text = $1",
  [PROGRAM_ID],
);
if (programRes.rows.length === 0) {
  console.error(`Program ${PROGRAM_ID} not found. Nothing written.`);
  await client.end();
  process.exit(1);
}
const program = programRes.rows[0];
console.log(`Program: ${program.name}`);
console.log(
  `Window : ${program.start_date.toISOString()} → ${program.end_date.toISOString()} (${program.duration_weeks} weeks)\n`,
);

const existing = await client.query(
  "SELECT COUNT(*)::int AS n FROM v2_sessions WHERE program_id::text = $1",
  [PROGRAM_ID],
);
if (existing.rows[0].n > 0) {
  console.error(
    `Program already has ${existing.rows[0].n} session(s). Refusing to duplicate. Nothing written.`,
  );
  await client.end();
  process.exit(1);
}

console.log("Plan:");
for (const session of SESSIONS) {
  console.log(
    `  week ${session.week} · ${session.date} ${session.start}–${session.end} · ${session.title} · handler ${session.handler.name}`,
  );
  console.log(
    `           deliverable: ${session.deliverable.title} (${session.deliverable.format}, due ${session.deliverable.due})`,
  );
}
console.log("");

if (DRY_RUN) {
  console.log("--dry-run: nothing written.");
  await client.end();
  process.exit(0);
}

await client.query("BEGIN");
try {
  const created = [];

  for (const session of SESSIONS) {
    const sessionResult = await client.query(
      "INSERT INTO v2_sessions (program_id, title, description, week_number, type, status, weight, scheduled_date, end_date, start_time, end_time, assignment_type, task_type, handler_id, handler_name, kpi_ids, notes, extra_materials, timezone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id",
      [
        PROGRAM_ID,
        session.title,
        session.description,
        session.week,
        "session",
        "not started",
        1,
        session.date,
        session.date,
        session.start,
        session.end,
        null,
        null,
        session.handler.id,
        session.handler.name,
        JSON.stringify(session.kpis),
        session.notes,
        JSON.stringify(session.materials),
        TIMEZONE,
      ],
    );
    const sessionId = sessionResult.rows[0].id;

    await client.query(
      "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight, kpi_ids, due_date, assignee_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
      [
        PROGRAM_ID,
        "Attendance",
        "System-generated attendance tracking",
        sessionId,
        "system",
        1,
        JSON.stringify([]),
        session.date,
        "all",
      ],
    );

    await client.query(
      "INSERT INTO v2_document_requirements (program_id, title, description, session_id, allowed_format, weight, kpi_ids, due_date, assignee_type, assignee_id, resource_url, resource_label) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
      [
        PROGRAM_ID,
        session.deliverable.title,
        session.deliverable.description,
        sessionId,
        session.deliverable.format,
        1,
        JSON.stringify(session.deliverable.kpis),
        session.deliverable.due,
        "all",
        null,
        null,
        null,
      ],
    );

    created.push({ id: sessionId, ...session });
  }

  // ── KPI progress cache (same shape as recalculateKpiProgress) ─────────────
  const participantsRes = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM participant_programs pp
       JOIN contacts c ON pp.participant_id = c.cid
      WHERE CAST(pp.program_id AS TEXT) = $1
        AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM v2_program_staff ps
           WHERE CAST(ps.program_id AS TEXT) = $1
             AND ps.role = 'facilitator'
             AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
        )`,
    [PROGRAM_ID],
  );
  const participantCount = participantsRes.rows[0].count;

  const measurable = new Map();
  for (const session of SESSIONS) {
    for (const kpiId of session.deliverable.kpis) {
      measurable.set(kpiId, (measurable.get(kpiId) || 0) + 1);
    }
  }

  await client.query("DELETE FROM kpi_progress WHERE program_id::text = $1", [PROGRAM_ID]);
  for (const [kpiId, linkedCount] of measurable) {
    // No submission is approved yet, so every rate is 0 — the same value the
    // recalculation would produce today.
    await client.query(
      `INSERT INTO kpi_progress (program_id, kpi_id, kpi_name, completion_rate, participant_count, approved_count, calculated_at)
       VALUES ($1, $2, $3, 0, $4, 0, NOW())
       ON CONFLICT (program_id, kpi_id) DO UPDATE SET
         kpi_name = EXCLUDED.kpi_name,
         completion_rate = EXCLUDED.completion_rate,
         participant_count = EXCLUDED.participant_count,
         approved_count = EXCLUDED.approved_count,
         calculated_at = NOW()`,
      [PROGRAM_ID, String(kpiId), KPI_TITLES[kpiId], participantCount],
    );
    console.log(
      `KPI cache: ${KPI_TITLES[kpiId]} → 0 % (${linkedCount} deliverable(s), ${participantCount} participant(s))`,
    );
  }

  await client.query("COMMIT");
  console.log("\nCommitted.");
  for (const session of created) {
    console.log(`  ✓ ${session.date} · ${session.title} · id ${session.id}`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("\nROLLED BACK — nothing written:", error.message);
  await client.end();
  process.exit(1);
}

const verify = await client.query(
  `SELECT s.week_number, s.title, s.scheduled_date, s.start_time, s.end_time, s.handler_name,
          (SELECT COUNT(*)::int FROM v2_document_requirements r WHERE r.session_id::text = s.id::text) AS requirements
     FROM v2_sessions s
    WHERE s.program_id::text = $1
    ORDER BY s.week_number`,
  [PROGRAM_ID],
);
console.log("\nVerification (v2_sessions):");
for (const row of verify.rows) {
  console.log(
    `  week ${row.week_number} · ${row.scheduled_date} ${row.start_time}–${row.end_time} · ${row.title} · ${row.handler_name} · ${row.requirements} requirement(s)`,
  );
}
console.log("");

await client.end();
