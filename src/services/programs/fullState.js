/**
 * Programs — the full-state bundle (SERVICE layer).
 *
 * The read assembly behind `/api/pm/full-state`: the fourteen-read program
 * bundle (one wave), then the persisted objective-progress read, the optional
 * metrics block and the calendar-day normalisation. The CONTROLLER keeps
 * authentication, the facilitator/assigned-PM gate and the response envelope;
 * everything below is how the bundle is PUT TOGETHER.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and shaping, no SQL, no HTTP. It
 * reads through `@/models/**` and returns the plain body the controller renders.
 */

import { averageKpiProgress } from "@/lib/constants";
import { toDayString } from "@/lib/programProgress";
import {
  recalculateKpiProgress,
  refreshKpiProgressIfStale,
} from "@/lib/kpi-progress";
import {
  getAssistantContactsByCids,
  getPersistedKpiProgress,
  getProgramFullStateData,
} from "@/models/programWorkspace";

/**
 * The JSON-parse a stored materials/attachments value defensively: older saves
 * double-stringified it, so the parse is retried a few levels down until an
 * array surfaces (or the attempts run out).
 */
function normalizeMaterials(raw) {
  if (typeof raw === "string") {
    let parsed = raw;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const parsedValue = JSON.parse(parsed);
        if (Array.isArray(parsedValue)) {
          parsed = parsedValue;
          break;
        }
        parsed = parsedValue;
      } catch {
        break;
      }
    }
    return Array.isArray(parsed) ? parsed : [];
  }
  return Array.isArray(raw) ? raw : [];
}

/** The note's attachments: parse a possibly double-encoded list, then shape each. */
function normalizeNoteFiles(raw) {
  let value;
  if (typeof raw === "string" && raw.trim()) {
    try {
      value = JSON.parse(raw);
    } catch {
      let candidate = raw;
      let parsed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          candidate = JSON.parse(candidate);
          parsed = true;
        } catch {
          break;
        }
      }
      value = parsed && Array.isArray(candidate) ? candidate : [];
    }
  } else {
    value = raw || [];
  }
  return Array.isArray(value) ? shapeNoteFiles(value) : value;
}

function shapeNoteFiles(list) {
  if (!Array.isArray(list)) return [];
  return list.map((noteFile) => {
    if (typeof noteFile === "object" && noteFile !== null) {
      return {
        name: noteFile.name || noteFile.NAME || noteFile.title || noteFile.TITLE || "",
        url: noteFile.url || noteFile.URL || noteFile.path || "",
        ...noteFile,
      };
    }
    if (typeof noteFile === "string") return { name: noteFile, url: noteFile };
    return noteFile;
  });
}

/**
 * Assemble the program workspace bundle for one program.
 *
 * @param {{id: string|number, includeMetrics?: boolean}} args
 * @returns {Promise<Object>} the response body
 */
export async function buildProgramFullState({ id, includeMetrics = false }) {
  const results = await getProgramFullStateData(id);

  const [
    programResult,
    participantsResult,
    teamsResult,
    sessionsResult,
    staffResult,
    eventsResult,
    kpisResult,
    documentsResult,
    followupsResult,
    assignedStaffResult,
    submissionsResult,
    reportsResult,
    familiesResult,
    deliverablesResult,
  ] = results;

  const program = programResult.rows[0];
  if (program) {
    try {
      program.materials = normalizeMaterials(program.materials);
      program.note_files = normalizeNoteFiles(program.note_files);

      // The note's attachments ride along with the program row (see
      // getProgramFullStateData), so listing them costs no extra read and no
      // dependent second wave.
      program.knowledge_assets = Array.isArray(program.knowledge_assets)
        ? program.knowledge_assets
        : [];

      // A second, inconsistent programme-progress figure was computed here
      // (sessions held × 5, deliverables checked × 2, report weeks filed × 10,
      // over a duration that fell back to 13 weeks). It ignored submissions
      // entirely and disagreed with the other two definitions, and no screen read
      // it — the screens that show a completion figure take it from the programme
      // LIST endpoint. The programme's figure is now computed in one place only.
    } catch {
      program.materials = [];
      program.knowledge_assets = [];
    }
  }

  let assignedStaff = assignedStaffResult.rows;
  // Dedupe (cid+email OR-match can produce duplicates).
  assignedStaff = Array.from(
    new Map(
      (assignedStaff || []).map((staffMember) => [
        staffMember.id ?? staffMember.cid ?? staffMember.staff_id,
        staffMember,
      ]),
    ).values(),
  );
  // Never show a bare id where a name is expected — fall back to email.
  assignedStaff = (assignedStaff || []).map((staffMember) => ({
    ...staffMember,
    name: staffMember.name || staffMember.email || staffMember.staff_id,
  }));
  let programFacilitators = [];

  // External facilitators (role='facilitator') are NOT internal staff — keep
  // them out of staffList so they never appear in staff workflows.
  if (Array.isArray(assignedStaff)) {
    programFacilitators = assignedStaff.filter(
      (staffMember) => String(staffMember.role || "").toLowerCase() === "facilitator",
    );
    assignedStaff = assignedStaff.filter(
      (staffMember) => String(staffMember.role || "").toLowerCase() !== "facilitator",
    );
  }

  if (program?.assigned_assistant_id) {
    try {
      const assistantIds = JSON.parse(program.assigned_assistant_id);
      if (Array.isArray(assistantIds) && assistantIds.length > 0) {
        const assistantsResult = await getAssistantContactsByCids(assistantIds);
        const merged = [...assignedStaff, ...assistantsResult.rows];
        assignedStaff = Array.from(
          new Map(merged.map((item) => [item.cid, item])).values(),
        );
      }
    } catch {}
  }

  // --- MERGE PARTICIPANTS (always) ---
  // Single source: participant_programs (real membership) + active account
  // + not facilitator + not deleted/archived. Dedupe by lowercase email.
  const allParticipantRows = participantsResult.rows;
  const mergedParticipants = Array.from(
    new Map(
      allParticipantRows
        .filter((participant) => participant.email)
        .filter((participant) => String(participant.status || "").toLowerCase() === "active")
        .map((participant) => [participant.email.toLowerCase(), participant]),
    ).values(),
  );

  // --- OPTIONAL METRICS (only when ?metrics=true) ---
  let kpisWithProgress = kpisResult.rows || [];
  let uniqueParticipants = mergedParticipants;
  // The previous initialiser read the removed second definition of programme
  // progress; the metrics branch reassigns this before any use.
  let operationalProgress = 0;
  let submissionRate = 0,
    approvalRate = 0;
  let expectedSubmissions = 0,
    actualSubmissions = 0,
    approvedSubmissions = 0;
  let totalParticipants = 0,
    overallHealth = 0;

  if (includeMetrics) {
    const kpiList = kpisResult.rows || [];
    const subList = submissionsResult.rows || [];

    // ─── KPI PROGRESS ───
    // Single source of truth: the approved-submission calculation cached in
    // kpi_progress. There is no per-screen provisional formula — when the cache
    // is empty the canonical recalculation runs and its result is used
    // immediately, so the first paint already matches the persisted numbers.
    const docList = documentsResult.rows || [];

    let progressEntries = [];
    try {
      progressEntries = (await getPersistedKpiProgress(id)).rows || [];
      if (progressEntries.length === 0) {
        const fresh = await recalculateKpiProgress(id);
        progressEntries = (fresh || []).map((progressRow) => ({
          kpi_id: progressRow.kpi_id,
          completion_rate: progressRow.completion_rate,
        }));
      }
    } catch (error) {
      console.warn(
        "kpi_progress unavailable, reporting no KPI progress:",
        error.message,
      );
    }

    kpisWithProgress = kpiList.map((kpi) => {
      const kpiId = String(kpi.id);
      const persisted = progressEntries.find(
        (progressRow) => String(progressRow.kpi_id) === kpiId,
      );
      const linkedDocs = docList.filter((documentRow) => {
        try {
          const ids =
            typeof documentRow.kpi_ids === "string"
              ? JSON.parse(documentRow.kpi_ids)
              : documentRow.kpi_ids || [];
          return ids.map(String).includes(kpiId);
        } catch {
          return false;
        }
      });
      // An objective with no linked deliverable has nothing to measure: it is
      // flagged so the screen can say so instead of showing a bare 0 %.
      const measurable = linkedDocs.length > 0;
      return {
        ...kpi,
        progress: persisted
          ? Math.round(parseFloat(persisted.completion_rate) || 0)
          : 0,
        linkedDocs: linkedDocs.length,
        completedDocs: linkedDocs.filter((documentRow) => documentRow.is_completed).length,
        measurable,
      };
    });

    // Keep the cache reasonably fresh without recalculating on every view:
    // approvals and requirement edits recalculate immediately on their own
    // routes, so this only bounds how long an unnoticed change can linger.
    refreshKpiProgressIfStale(id).catch(() => {});

    totalParticipants = uniqueParticipants.length;
    expectedSubmissions = totalParticipants * docList.length;
    actualSubmissions = subList.length;
    approvedSubmissions = subList.filter(
      (submission) => submission.status === "approved",
    ).length;
    submissionRate =
      expectedSubmissions > 0
        ? Math.round((actualSubmissions / expectedSubmissions) * 100)
        : 0;
    approvalRate =
      actualSubmissions > 0
        ? Math.round((approvedSubmissions / actualSubmissions) * 100)
        : 0;
    // Programme progress is the plain average of its measurable objectives
    // (every objective weighs the same). Non-measurable objectives are left
    // out; a programme with none has no objective progress to report.
    const measurableKpis = kpisWithProgress.filter((kpi) => kpi.measurable);
    operationalProgress =
      measurableKpis.length > 0 ? averageKpiProgress(measurableKpis) : 0;
    overallHealth = Math.round((operationalProgress + approvalRate) / 2);
  }

  // Calendar-day fields leave as plain "YYYY-MM-DD" days. The screen compares
  // them as days; sent as instants they shift by one for any reader in another
  // timezone, which can move an item across the "due / not yet due" boundary.
  // Stored values are untouched — this changes only what the screen receives.
  const asDay = (row, field) => {
    if (row && row[field] != null) row[field] = toDayString(row[field]);
  };
  if (program) {
    asDay(program, "start_date");
    asDay(program, "end_date");
  }
  (sessionsResult.rows || []).forEach((session) => {
    asDay(session, "scheduled_date");
    asDay(session, "end_date");
  });
  (deliverablesResult.rows || []).forEach((deliverable) => asDay(deliverable, "due_date"));
  // The deliverables the panel actually scores come from the document-requirements
  // table, so its due date leaves as a plain day too — the fix must not depend on
  // how the field happens to be stored in another database.
  (documentsResult.rows || []).forEach((documentRow) => asDay(documentRow, "due_date"));
  (uniqueParticipants || []).forEach((participant) => asDay(participant, "enrolled_at"));

  return {
    success: true,
    program,
    participants: uniqueParticipants,
    teams: teamsResult.rows,
    sessions: sessionsResult.rows,
    staffList: staffResult.rows,
    events: eventsResult.rows,
    kpis: kpisWithProgress,
    documents: documentsResult.rows,
    followups: followupsResult.rows,
    assignedStaff,
    facilitators: programFacilitators,
    submissions: submissionsResult.rows,
    reports: reportsResult.rows,
    families: familiesResult.rows,
    deliverables: deliverablesResult.rows,
    metrics: includeMetrics
      ? {
          operational: {
            progress: operationalProgress,
            kpis: kpisWithProgress.map((kpi) => ({
              id: kpi.id,
              title: kpi.title,
              progress: kpi.progress,
              measurable: kpi.measurable,
            })),
          },
          student: {
            submissionRate,
            approvalRate,
            expectedSubmissions,
            actualSubmissions,
            approvedSubmissions,
            totalParticipants,
          },
          overallHealth,
        }
      : undefined,
  };
}
