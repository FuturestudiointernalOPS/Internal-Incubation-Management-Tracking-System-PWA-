import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireProgramFacilitator, hasProgramManagementAccess, isAssignedPmForProgram } from "@/lib/auth";
import {
  recalculateKpiProgress,
  refreshKpiProgressIfStale,
} from "@/lib/kpi-progress";
import { weightedKpiProgress } from "@/lib/constants";
import { toDayString } from "@/lib/programProgress";
import {
  getAssistantContactsByCids,
  getPersistedKpiProgress,
  getProgramFullStateData,
  getProgramNoteAttachments,
} from "@/models/programWorkspace";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    // Phase I6B: access is decided below for every non-management session —
    // assigned PM of the program, else requireProgramFacilitator (program
    // assignment). The removed role pre-filter blocked baseline Members who
    // hold a legitimate facilitator assignment.
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams: sp } = new URL(req.url);
    const progId = sp.get("id");

    // Facilitators must be assigned to this program before seeing its data.
    // Bypass for: super_admin, program_manager (hasProgramManagementAccess)
    // AND for any staff member who is the explicitly assigned PM of this program.
    if (progId) {
      const session = await getSession();
      if (session && !hasProgramManagementAccess(session.role)) {
        const isPm = await isAssignedPmForProgram(progId, session.cid);
        if (!isPm) {
          const guardError = await requireProgramFacilitator(progId);
          if (guardError) return guardError;
        }
      }
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const includeMetrics = searchParams.get("metrics") === "true";

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

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
        // Defensive: materials may be double-stringified from older saves
        if (typeof program.materials === "string") {
          let parsed = program.materials;
          // Try to parse up to 4 levels of nesting
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              const parsedValue = JSON.parse(parsed);
              if (Array.isArray(parsedValue)) { parsed = parsedValue; break; }
              parsed = parsedValue;
            } catch { break; }
          }
          program.materials = Array.isArray(parsed) ? parsed : [];
        } else {
          program.materials = Array.isArray(program.materials) ? program.materials : [];
        }

        if (
          typeof program.note_files === "string" &&
          program.note_files.trim()
        ) {
          try {
            program.note_files = JSON.parse(program.note_files);
          } catch {
            let value = program.note_files;
            let parsed = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                value = JSON.parse(value);
                parsed = true;
              } catch {
                break;
              }
            }
            program.note_files = parsed && Array.isArray(value) ? value : [];
          }
        } else {
          program.note_files = program.note_files || [];
        }
        if (Array.isArray(program.note_files)) {
          program.note_files = program.note_files.map((noteFile) => {
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

        if (program.note_id) {
          const attachmentsResult = await getProgramNoteAttachments(program.note_id);
          program.knowledge_assets = attachmentsResult.rows;
        } else {
          program.knowledge_assets = [];
        }

        const sessions = sessionsResult.rows || [];
        const documents = documentsResult.rows || [];
        const reports = reportsResult.rows || [];

        const totalSessions = sessions.length;
        const completedSessions = sessions.filter(
          (session) => session.status === "completed",
        ).length;
        const totalDocs = documents.length;
        const completedDocs = documents.filter((documentRow) => documentRow.is_completed).length;
        const uniqueReportWeeks = new Set(reports.map((report) => report.week_number))
          .size;

        const totalPoints =
          totalSessions * 5.0 +
          totalDocs * 2.0 +
          (program.duration_weeks || 13) * 10.0;
        const completedPoints =
          completedSessions * 5.0 +
          completedDocs * 2.0 +
          uniqueReportWeeks * 10.0;

        program.completion_index =
          totalPoints > 0 ? (completedPoints / totalPoints) * 100.0 : 0;
      } catch {
        program.materials = [];
        program.knowledge_assets = [];
        program.completion_index = 0;
      }
    }

    let assignedStaff = assignedStaffResult.rows;
    // Dedupe (cid+email OR-match can produce duplicates)
    assignedStaff = Array.from(
      new Map((assignedStaff || []).map((staffMember) => [staffMember.id ?? staffMember.cid ?? staffMember.staff_id, staffMember])).values(),
    );
    // Never show a bare id where a name is expected — fall back to email
    assignedStaff = (assignedStaff || []).map((staffMember) => ({
      ...staffMember,
      name: staffMember.name || staffMember.email || staffMember.staff_id,
    }));
    let programFacilitators = [];

    // External facilitators (role='facilitator') are NOT internal staff —
    // keep them out of staffList so they never appear in staff workflows.
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
    let operationalProgress = program?.completion_index || 0;
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
      // kpi_progress. There is no per-screen provisional formula — when the
      // cache is empty the canonical recalculation runs and its result is used
      // immediately, so the first paint already matches the persisted numbers.
      const sessionList = sessionsResult.rows || [];
      const docList = documentsResult.rows || [];
      const kpiWeight = (kpi) =>
        parseFloat(kpi.weight) ||
        (kpiList.length > 0 ? Math.round(100 / kpiList.length) : 0);

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
        const linkedSessions = sessionList.filter((session) => {
          try {
            const ids =
              typeof session.kpi_ids === "string"
                ? JSON.parse(session.kpi_ids)
                : session.kpi_ids || [];
            return ids.map(String).includes(kpiId);
          } catch {
            return false;
          }
        });
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
        return {
          ...kpi,
          progress: persisted
            ? Math.round(parseFloat(persisted.completion_rate) || 0)
            : 0,
          weight: kpiWeight(kpi),
          linkedSessions: linkedSessions.length,
          completedSessions: linkedSessions.filter(
            (session) => session.status === "completed",
          ).length,
          linkedDocs: linkedDocs.length,
          completedDocs: linkedDocs.filter((documentRow) => documentRow.is_completed).length,
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
      // Operational progress is the KPI progress, using the same weighted
      // definition as the PM dashboard (equal weights when none is set).
      operationalProgress =
        kpisWithProgress.length > 0
          ? weightedKpiProgress(kpisWithProgress)
          : program?.completion_index || 0;
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
    (uniqueParticipants || []).forEach((participant) => asDay(participant, "enrolled_at"));

    return NextResponse.json({
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
                weight: kpi.weight,
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
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
