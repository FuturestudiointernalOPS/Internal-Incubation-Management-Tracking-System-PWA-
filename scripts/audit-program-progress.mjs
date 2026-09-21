/**
 * PROGRAMME PROGRESS — READ-ONLY PORTFOLIO AUDIT (production / staging)
 *
 * WHICH QUESTION IT ANSWERS
 * "What will the new programme-progress panel display for every programme on
 * the real database — and what must be fixed first for those numbers to be
 * honest?"
 *
 * It is NOT a test of the calculator. The calculator is already tested with
 * hand-made inputs; what cannot be tested that way is the DATA. A programme
 * whose deliverables carry no date at all is counted as owed from its first
 * day, which is correct by design but reads as a low percentage; a programme
 * whose start date is missing has no weekly clock; a roster with no enrolment
 * dates makes every participant expected from week 1. Those are data facts,
 * and this tool measures them on the live database.
 *
 * HOW IT MAPS TO THE PANEL'S OWN CALCULATION
 * The panel does not compute anything itself: it feeds the pure calculator
 * `computeProgramProgress` (src/lib/programProgress.js) with five queries.
 * This audit issues those SAME five queries — copied verbatim from
 * `getProgramFullStateData` (src/models/programWorkspace.js), same WHERE
 * clauses, same argument shapes — and passes the same rows to the same
 * function. `today` is deliberately NOT passed, so the calculator reads the
 * real current day: that is the point of an audit, its numbers must be the
 * numbers the panel shows today.
 *
 * READ-ONLY: SELECT statements only. No INSERT / UPDATE / DELETE / DDL, no
 * transaction, no write of any kind. The connection string is never printed —
 * only the name of the env file that answered. One failing programme is
 * reported as ÉCHEC and the scan continues.
 *
 * Run: node scripts/audit-program-progress.mjs
 * Exit codes: 0 = report produced · 2 = no working DATABASE_URL / no data read
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ─── Boot: pick the FIRST env file whose DATABASE_URL actually answers ───────
// Credentials can be stale in an older file, so each candidate is probed with a
// real `SELECT 1` before it is adopted. Values are never printed.
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
    const probe = await import("pg");
    const pool = new probe.default.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await pool.query("SELECT 1");
    await pool.end();
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

// Imported AFTER the probe so the db engine picks up the URL that answered.
// initDb() is deliberately NOT called: it issues a schema-maintenance DDL
// statement (`ALTER ROLE … SET statement_timeout`), and this tool must write
// nothing at all. `db.execute` alone opens the pool lazily and only sends the
// SELECTs below.
const { default: db } = await import("../src/lib/db.js");
const { computeProgramProgress, toDayString, SYSTEM_REQUIREMENT_FORMAT } = await import(
  "../src/lib/programProgress.js",
);

console.log(`[audit-program-progress] connected via ${usedEnvFile}`);

// ─── Small helpers ──────────────────────────────────────────────────────────
const isTrue = (v) => v === true || v === 1 || v === "1" || v === "true";
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const cut = (value, width) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim() || "(sans nom)";
  return text.length > width ? `${text.slice(0, width - 1)}…` : text;
};
const pad = (value, width) => String(value).padEnd(width);
// Same id coercion as the calculator's private `key`, so a deliverable is
// matched to its session here exactly as it is matched there.
const idKey = (value) => (value === null || value === undefined ? "" : String(value));

/**
 * Rows the calculator excludes because the platform generated them: one
 * "attendance" requirement per session, filled in by staff and never handed in
 * by a participant. The marker is IMPORTED from the calculator instead of being
 * retyped here — the audit and the score must never disagree on what counts as
 * an excluded row. The FORMAT field decides, never the title: an ordinary
 * deliverable legitimately called "Attendance" is still a participant's to hand
 * in.
 */
const isSystemRequirement = (requirement) =>
  String(requirement?.allowed_format ?? "").trim().toLowerCase() === SYSTEM_REQUIREMENT_FORMAT;

// ─── The five queries the panel runs, copied verbatim from the model ────────
// Source: src/models/programWorkspace.js → getProgramFullStateData
const loadProgramState = async (id) => {
  const [sessions, requirements, reports, submissions, participants] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM v2_sessions WHERE program_id = ? AND (status IS NULL OR status != 'archived')",
      args: [id],
    }),
    db.execute({
      sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
      args: [id],
    }),
    db.execute({
      sql: "SELECT * FROM v2_weekly_reports WHERE program_id = ? ORDER BY week_number DESC",
      args: [id],
    }),
    db.execute({
      sql: `SELECT s.*, 
                     c.name as participant_name, 
                     d.title as deliverable_title
              FROM v2_submissions s
              LEFT JOIN contacts c ON s.participant_id::text = c.cid
              LEFT JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
              WHERE s.program_id::text = ?`,
      args: [id],
    }),
    db.execute({
      sql: `SELECT CAST(c.cid AS TEXT) as id, pp.program_id, c.name, c.email, c.phone,
                     COALESCE(pp.screening_status, 'pending') as screening_status, c.status, c.created_at, c.group_name,
                     'enrolled' as source,
                     COALESCE(pp.accepted_at, pp.assigned_at) as enrolled_at, c.v2_team_id
              FROM participant_programs pp
              JOIN contacts c ON pp.participant_id = c.cid
              WHERE CAST(pp.program_id AS TEXT) = ?
                AND c.deleted = 0
                AND c.deleted_at IS NULL
                AND c.archived_at IS NULL
                AND LOWER(COALESCE(c.status, '')) = 'active'
                AND NOT EXISTS (
                  SELECT 1 FROM v2_program_staff ps
                  WHERE CAST(ps.program_id AS TEXT) = ?
                    AND ps.role = 'facilitator'
                    AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
                )`,
      args: [String(id), String(id)],
    }),
  ]);
  return {
    sessions: sessions.rows,
    requirements: requirements.rows,
    reports: reports.rows,
    submissions: submissions.rows,
    participants: participants.rows,
  };
};

// ─── 1. Every programme, then the archived/template filter in JS ────────────
// The flags are read as TRUTHY, never as "column exists": if this database has
// no `is_archived` / `is_template` column the value is undefined and the row is
// kept. A missing column must never be able to empty the report.
let allPrograms = [];
try {
  allPrograms = (await db.execute({ sql: "SELECT * FROM v2_programs", args: [] })).rows;
} catch (e) {
  console.error(`Could not read v2_programs: ${e.message}`);
  process.exit(2);
}

const programs = allPrograms.filter(
  (p) => !isTrue(p?.is_archived) && !isTrue(p?.is_template),
);
const skipped = allPrograms.length - programs.length;

// Does this database even carry those two flag columns? If not, the filter
// above is a no-op by construction and the report says so explicitly.
let columns = [];
try {
  columns = (
    await db.execute({
      sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'v2_programs'",
      args: [],
    })
  ).rows.map((r) => String(r.column_name));
} catch {}
const columnState = (name) =>
  columns.length === 0 ? "inconnue" : columns.includes(name) ? "présente" : "absente";

// ─── 2. One pass per programme through the panel's own calculator ───────────
const results = [];
const failures = [];

for (const program of programs) {
  try {
    const state = await loadProgramState(program.id);
    // `today` is intentionally omitted → the calculator uses the real day.
    const progress = computeProgramProgress({ program, ...state });

    const dq = progress.dataQuality;
    const sessionsTotal = state.sessions.length;
    const sessionsDated = state.sessions.filter((s) => toDayString(s?.scheduled_date)).length;
    const sessionsWeekOnly = state.sessions.filter(
      (s) => !toDayString(s?.scheduled_date) && (num(s?.week_number) ?? 0) > 0,
    ).length;
    // ── Deliverable rows, split so the raw figures agree with the score ──────
    // The calculator drops system-generated attendance rows before it counts
    // anything (pace block, expected submissions, denominator, overdue), so a
    // raw column that still counted them printed "livrables 8/8" next to a
    // denominator computed from 4. The split below reads the three participant
    // buckets FROM THE ROWS. It must never be done by subtraction: deriving
    // "dated via its session" as total − own-dated − undated silently poured
    // the excluded attendance rows into that bucket, and that is the very
    // number that went wrong.
    const requirementsTotal = state.requirements.length;
    // Session dates resolved exactly as the calculator resolves them, so
    // "dated through its session" means the same thing on both sides.
    const sessionDayById = new Map();
    for (const session of state.sessions) {
      const day = toDayString(session?.scheduled_date);
      if (day) sessionDayById.set(idKey(session?.id), day);
    }
    const hasWeek = (row) => {
      const week = Number(row?.week_number);
      return Number.isFinite(week) && week > 0;
    };
    const requirementsOwnDate = (row) => Boolean(toDayString(row?.due_date));
    // Same resolution as the calculator: a session date counts on its own, a
    // bare week number only once the programme has an anchor to count from.
    const requirementsSessionDate = (row) =>
      sessionDayById.has(idKey(row?.session_id)) || (hasWeek(row) && Boolean(progress.startDate));
    const participantRows = state.requirements.filter((row) => !isSystemRequirement(row));
    // Excluded rows: the calculator's own tally (built with the same imported
    // marker over the same rows) is authoritative; the row scan only backs it up.
    const requirementsSystemRows = state.requirements.filter(isSystemRequirement).length;
    const requirementsSystem = num(dq?.systemRequirements) ?? requirementsSystemRows;
    const requirementsParticipant = participantRows.length;
    const requirementsOwnDated = participantRows.filter(requirementsOwnDate).length;
    const requirementsViaSession = participantRows.filter(
      (row) => !requirementsOwnDate(row) && requirementsSessionDate(row),
    ).length;
    const requirementsUndated =
      num(dq?.undatedRequirements) ??
      participantRows.filter((row) => !requirementsOwnDate(row) && !requirementsSessionDate(row))
        .length;

    results.push({
      program,
      progress,
      state,
      raw: {
        sessionsTotal,
        sessionsDated,
        sessionsWeekOnly,
        sessionsNeither: sessionsTotal - sessionsDated - sessionsWeekOnly,
        requirementsTotal,
        requirementsSystem,
        requirementsParticipant,
        requirementsOwnDated,
        requirementsViaSession,
        requirementsUndated,
        submissionsTotal: state.submissions.length,
        unlinkedSubmissions: dq.unlinkedSubmissions,
        participantsTotal: state.participants.length,
        participantsWithoutDate: dq.participantsWithoutEnrolmentDate,
        expectedSubmissions: progress.participantWork.expected,
        noStartDate: !program?.start_date,
        noDuration: num(program?.duration_weeks) === null || num(program?.duration_weeks) <= 0,
        missingDurationFlag: dq.missingDuration,
      },
    });
  } catch (e) {
    failures.push({ id: program?.id, name: program?.name, error: e.message });
  }
}

const asOf = toDayString(new Date());
const out = [];
const emit = (text = "") => out.push(text);

// ─── 3a. Header ─────────────────────────────────────────────────────────────
emit("─".repeat(110));
emit("AUDIT — PROGRÈS DES PROGRAMMES (lecture seule · SELECT uniquement)");
emit(`jour de référence : ${asOf} · ${results.length} programme(s) analysé(s)`);
emit("─".repeat(110));
emit(`v2_programs : ${allPrograms.length} ligne(s) · ${programs.length} analysée(s) · ${skipped} ignorée(s) (archivé ou modèle) · ${failures.length} en ÉCHEC`);
emit(`colonnes de filtrage — is_archived : ${columnState("is_archived")} · is_template : ${columnState("is_template")}`);
emit("");

// ─── 3b. Portfolio counters ─────────────────────────────────────────────────
const sum = (pick) => results.reduce((total, r) => total + pick(r), 0);
const counter = (label, value) => emit(`    ${pad(label, 62)}: ${value}`);

const noStart = results.filter((r) => r.raw.noStartDate);
const noStartButAnchored = noStart.filter((r) => r.progress.startDate);
const noDuration = results.filter((r) => r.raw.noDuration);
const notReady = results.filter((r) => !r.progress.ready);

emit("PORTEFEUILLE");
counter("programmes analysés", results.length);
counter("programmes sans date de début (start_date)", noStart.length);
counter("  dont le calendrier tourne quand même (1re séance datée)", noStartButAnchored.length);
counter("programmes sans durée déclarée (duration_weeks)", noDuration.length);
counter("séances — total", sum((r) => r.raw.sessionsTotal));
counter("  avec une date", sum((r) => r.raw.sessionsDated));
counter("  sans date mais avec un numéro de semaine", sum((r) => r.raw.sessionsWeekOnly));
counter("  sans date et sans semaine", sum((r) => r.raw.sessionsNeither));
counter("livrables — total (toutes les lignes)", sum((r) => r.raw.requirementsTotal));
counter("  dont exigences système de la plateforme (hors calcul)", sum((r) => r.raw.requirementsSystem));
counter("  dont produits par les participants (base du score)", sum((r) => r.raw.requirementsParticipant));
counter("    avec leur propre échéance", sum((r) => r.raw.requirementsOwnDated));
counter("    datés uniquement via leur séance (ou semaine)", sum((r) => r.raw.requirementsViaSession));
counter("    sans date et sans séance", sum((r) => r.raw.requirementsUndated));
counter("participants actifs (comme le panneau les compte) — total", sum((r) => r.raw.participantsTotal));
counter("  sans date d'adhésion", sum((r) => r.raw.participantsWithoutDate));
counter("copies attendues (paires personne × livrable exigible)", sum((r) => r.raw.expectedSubmissions));
counter("copies déposées — total", sum((r) => r.raw.submissionsTotal));
counter("  rattachées à aucun livrable connu", sum((r) => r.raw.unlinkedSubmissions));
counter("programmes « rien d'exigible » (ready === false)", notReady.length);
emit("");

// ─── 3c. One line per programme, worst first ────────────────────────────────
const COLS = [
  ["id", 36],
  ["nom", 28],
  ["sem.", 9],
  ["début", 11],
  ["séances", 11],
  ["livrables", 18],
  ["participants", 14],
  ["attendues", 10],
  ["%", 14],
];
emit("PROGRAMMES — du pire au meilleur (les « rien d'exigible » en dernier)");
emit(
  "  " +
    COLS.map(([label, width]) => pad(label, width)).join(" ") +
    "signaux",
);
emit(
  "  " +
    COLS.map(([, width]) => "─".repeat(width)).join(" ") +
    "─".repeat(60),
);

const sorted = [...results].sort((a, b) => {
  // Programmes with nothing owed yet carry no percentage, so they are ranked
  // last; among themselves the name keeps the order stable and readable.
  const rankA = a.progress.ready ? 0 : 1;
  const rankB = b.progress.ready ? 0 : 1;
  if (rankA !== rankB) return rankA - rankB;
  if (a.progress.headline.percent !== b.progress.headline.percent) {
    return a.progress.headline.percent - b.progress.headline.percent;
  }
  return String(a.program?.name ?? "").localeCompare(String(b.program?.name ?? ""));
});

for (const r of sorted) {
  const dq = r.progress.dataQuality;
  const flags = [];
  if (dq.missingStartDate) flags.push("sans-début");
  if (dq.missingDuration) flags.push("sans-durée");
  if (dq.undatedSessions) flags.push(`sans-date:${dq.undatedSessions}`);
  // Sessions whose date has passed with no status recorded: they are counted as
  // not held, so this is an operational gap to close, not a scoring choice.
  if (dq.pastSessionsWithoutStatus) {
    flags.push(`séances-sans-statut:${dq.pastSessionsWithoutStatus}`);
  }
  if (dq.undatedRequirements) flags.push(`livr-sans-échéance:${dq.undatedRequirements}`);
  if (dq.unlinkedSubmissions) flags.push(`copies-non-liées:${dq.unlinkedSubmissions}`);
  if (dq.participantsWithoutEnrolmentDate) {
    flags.push(`adhésions-sans-date:${dq.participantsWithoutEnrolmentDate}`);
  }

  const cells = [
    pad(cut(r.program?.id, 36), COLS[0][1]),
    pad(cut(r.program?.name, 28), COLS[1][1]),
    pad(
      `${r.progress.weeksDue}/${r.progress.plannedWeeks ?? "—"}`,
      COLS[2][1],
    ),
    pad(r.progress.startDate ?? "—", COLS[3][1]),
    pad(`${r.raw.sessionsDated}/${r.raw.sessionsTotal}`, COLS[4][1]),
    pad(
      `${r.raw.requirementsOwnDated + r.raw.requirementsViaSession}/${r.raw.requirementsParticipant} (+${r.raw.requirementsSystem} syst.)`,
      COLS[5][1],
    ),
    pad(`${r.raw.participantsTotal} (${r.raw.participantsWithoutDate})`, COLS[6][1]),
    pad(String(r.raw.expectedSubmissions), COLS[7][1]),
    pad(r.progress.ready ? `${r.progress.headline.percent}%` : "rien d'exigible", COLS[8][1]),
  ];
  emit("  " + cells.join(" ") + (flags.join(" ") || "—"));
}
emit("");
emit("  id=identifiant · sem.=semaines dues/durée déclarée · début=début retenu (start_date, sinon 1re séance datée)");
emit("  séances=datées/total · livrables=datés/total des seuls livrables des participants (+n syst.=exigences système exclues du calcul)");
emit("  un livrable sans date compte comme exigible dès le début · séances-sans-statut=séances passées dont le statut n'a pas été saisi, comptées non tenues");
emit("  participants=total (sans date d'adhésion) · attendues=copies attendues · signaux=indicateurs de qualité de données");
emit("");

// ─── 3d. Failures (never fatal: the scan continues past them) ───────────────
if (failures.length > 0) {
  emit("ÉCHECS — programmes non calculables (à corriger, probablement une colonne ou un lien manquant)");
  for (const f of failures) {
    emit(`    ${pad(cut(f.id, 36), 38)}${pad(cut(f.name, 28), 30)}${f.error}`);
  }
  emit("");
}

// ─── 3e. ACTIONS ────────────────────────────────────────────────────────────
const listPrograms = (rows, detailOf) => {
  if (rows.length === 0) {
    emit("    (aucun)");
    return;
  }
  for (const r of rows) {
    const detail = detailOf(r);
    emit(`    ${pad(cut(r.program?.id, 36), 38)}${pad(cut(r.program?.name, 28), 30)}${detail}`);
  }
};

emit("ACTIONS — ce qu'il faut corriger pour que les chiffres soient honnêtes");

emit("");
emit(`1. Aucune date de début — le calendrier hebdomadaire ne peut pas tourner (${noStart.length})`);
listPrograms(
  noStart,
  (r) =>
    `start_date=""; ${r.raw.sessionsDated} séance(s) datée(s) → début retenu : ${r.progress.startDate ?? "aucun (semaines dues = 0)"}`,
);

const undatedReq = results.filter((r) => r.raw.requirementsUndated > 0);
emit("");
emit(
  `2. Livrables sans aucune date — comptés comme exigibles depuis le début, d'où un % bas dès le premier jour (${undatedReq.length})`,
);
listPrograms(
  undatedReq,
  (r) =>
    `${r.raw.requirementsUndated}/${r.raw.requirementsTotal} livrable(s) sans date` +
    `${r.progress.startDate ? "" : " · sans début déclaré non plus"}`,
);

const orphanSessions = results.filter((r) => r.raw.sessionsNeither > 0);
emit("");
emit(
  `3. Séances sans date ET sans numéro de semaine — jamais dues, jamais comptées (${orphanSessions.length})`,
);
listPrograms(
  orphanSessions,
  (r) =>
    `${r.raw.sessionsNeither}/${r.raw.sessionsTotal} séance(s) sans date ni semaine` +
    ` · sans-date signalé par le calculateur : ${r.progress.dataQuality.undatedSessions}`,
);

const undatedMembers = results.filter((r) => r.raw.participantsWithoutDate > 0);
emit("");
emit(
  `4. Participants sans date d'adhésion — attendus sur TOUT livrable, y compris ceux antérieurs à leur arrivée (${undatedMembers.length})`,
);
listPrograms(
  undatedMembers,
  (r) =>
    `${r.raw.participantsWithoutDate}/${r.raw.participantsTotal} personne(s) sans date` +
    ` · copies attendues : ${r.raw.expectedSubmissions}`,
);

emit("");
emit(`5. Rien d'exigible du tout — le panneau affichera « rien d'exigible » (${notReady.length})`);
listPrograms(
  notReady,
  (r) =>
    `séances datées ${r.raw.sessionsDated} · livrables datés par les participants ${r.raw.requirementsOwnDated + r.raw.requirementsViaSession}` +
    ` · semaine écoulée ${r.progress.weeksDue > 0 ? "oui" : "non"} (début : ${r.progress.startDate ?? "aucun"})`,
);

const unlinked = results.filter((r) => r.raw.unlinkedSubmissions > 0);
emit("");
emit(
  `6. Copies déposées rattachées à aucun livrable connu — invisibles dans le score (${unlinked.length})`,
);
listPrograms(
  unlinked,
  (r) => `${r.raw.unlinkedSubmissions}/${r.raw.submissionsTotal} copie(s) non rattachée(s)`,
);

// New signal reported by the calculator. It is phrased as a to-do, not as a bug:
// the calculator has to treat a past session with no status as not held, because
// the record is the only evidence there is — so the missing status is what must
// be filled in for the programme's own figures to stop reading as failure.
const sessionsNoStatus = results.filter(
  (r) => r.progress.dataQuality.pastSessionsWithoutStatus > 0,
);
emit("");
emit(
  `7. Séances passées sans statut enregistré — elles comptent comme NON TENUES tant que le statut n'est pas saisi (${sessionsNoStatus.length})`,
);
listPrograms(sessionsNoStatus, (r) => {
  const open = r.progress.late.sessions.filter((s) => s.unrecorded);
  const titles = open
    .slice(0, 3)
    .map((s) => `${s.title || "(sans titre)"}${s.week ? ` S${s.week}` : ""}`)
    .join(" · ");
  return (
    `${r.progress.dataQuality.pastSessionsWithoutStatus}/${r.progress.late.sessions.length} séance(s) due(s) sans statut` +
    " · statut à saisir (tenue ou non tenue)" +
    (titles ? ` · ${titles}${open.length > 3 ? " …" : ""}` : "")
  );
});

// ─── 3f. Final line ─────────────────────────────────────────────────────────
emit("");
emit("─".repeat(110));
emit("Pour relancer : node scripts/audit-program-progress.mjs");
emit("Aucune écriture : cette exécution n'a exécuté que des SELECT. Rien n'a été modifié en base.");
emit("─".repeat(110));

const report = out.join("\n") + "\n";
// db.js keeps its pool private (no exported end()), so the process is
// terminated explicitly — but only once stdout has actually flushed, otherwise
// a piped report can be truncated mid-line.
await new Promise((done) => process.stdout.write(report, done));
process.exit(0);
