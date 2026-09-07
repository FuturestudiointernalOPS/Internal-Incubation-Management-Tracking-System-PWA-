import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireProgramFacilitator, hasProgramManagementAccess, isAssignedPmForProgram } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";
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
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "facilitator",
    ]);
    if (authError) return authError;

    const { searchParams: sp } = new URL(req.url);
    const progId = sp.get("id");

    // Facilitators must be assigned to this program before seeing its data.
    // Bypass for: super_admin, program_manager, teacher (hasProgramManagementAccess)
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
      progRes,
      participantsRes,
      teamRes,
      sesRes,
      staffRes,
      eventRes,
      kpiRes,
      docRes,
      folRes,
      assignedStaffRes,
      subRes,
      repRes,
      famRes,
      delRes,
    ] = results;

    const program = progRes.rows[0];
    if (program) {
      try {
        // Defensive: materials may be double-stringified from older saves
        if (typeof program.materials === "string") {
          let parsed = program.materials;
          // Try to parse up to 4 levels of nesting
          for (let i = 0; i < 4; i++) {
            try {
              const p = JSON.parse(parsed);
              if (Array.isArray(p)) { parsed = p; break; }
              parsed = p;
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
          } catch (e) {
            let value = program.note_files;
            let parsed = false;
            for (let i = 0; i < 3; i++) {
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
          program.note_files = program.note_files.map((f) => {
            if (typeof f === "object" && f !== null) {
              return {
                name: f.name || f.NAME || f.title || f.TITLE || "",
                url: f.url || f.URL || f.path || "",
                ...f,
              };
            }
            if (typeof f === "string") return { name: f, url: f };
            return f;
          });
        }

        if (program.note_id) {
          const kbAttachmentsRes = await getProgramNoteAttachments(program.note_id);
          program.knowledge_assets = kbAttachmentsRes.rows;
        } else {
          program.knowledge_assets = [];
        }

        const sessions = sesRes.rows || [];
        const documents = docRes.rows || [];
        const reports = repRes.rows || [];

        const totalSessions = sessions.length;
        const completedSessions = sessions.filter(
          (s) => s.status === "completed",
        ).length;
        const totalDocs = documents.length;
        const completedDocs = documents.filter((d) => d.is_completed).length;
        const uniqueReportWeeks = new Set(reports.map((r) => r.week_number))
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
      } catch (e) {
        program.materials = [];
        program.knowledge_assets = [];
        program.completion_index = 0;
      }
    }

    let assignedStaff = assignedStaffRes.rows;
    // Dedupe (cid+email OR-match can produce duplicates)
    assignedStaff = Array.from(
      new Map((assignedStaff || []).map((r) => [r.id ?? r.cid ?? r.staff_id, r])).values(),
    );
    // Never show a bare id where a name is expected — fall back to email
    assignedStaff = (assignedStaff || []).map((r) => ({
      ...r,
      name: r.name || r.email || r.staff_id,
    }));
    let programFacilitators = [];

    // External facilitators (role='facilitator') are NOT internal staff —
    // keep them out of staffList so they never appear in staff workflows.
    if (Array.isArray(assignedStaff)) {
      programFacilitators = assignedStaff.filter(
        (r) => String(r.role || "").toLowerCase() === "facilitator",
      );
      assignedStaff = assignedStaff.filter(
        (r) => String(r.role || "").toLowerCase() !== "facilitator",
      );
    }

    if (program?.assigned_assistant_id) {
      try {
        const assistantIds = JSON.parse(program.assigned_assistant_id);
        if (Array.isArray(assistantIds) && assistantIds.length > 0) {
          const assistantsRes = await getAssistantContactsByCids(assistantIds);
          const merged = [...assignedStaff, ...assistantsRes.rows];
          assignedStaff = Array.from(
            new Map(merged.map((item) => [item.cid, item])).values(),
          );
        }
      } catch (e) {}
    }

    // --- MERGE PARTICIPANTS (always) ---
    // Single source: participant_programs (real membership) + active account
    // + not facilitator + not deleted/archived. Dedupe by lowercase email.
    const allParticipantRows = participantsRes.rows;
    const mergedParticipants = Array.from(
      new Map(
        allParticipantRows
          .filter((p) => p.email)
          .filter((p) => String(p.status || "").toLowerCase() === "active")
          .map((p) => [p.email.toLowerCase(), p]),
      ).values(),
    );

    // --- OPTIONAL METRICS (only when ?metrics=true) ---
    let kpisWithProgress = kpiRes.rows || [];
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
      const kpiList = kpiRes.rows || [];
      const subList = subRes.rows || [];

      // ─── PERSISTED KPI PROGRESS ───
      // Read from kpi_progress table (pre-calculated, updated on session/doc changes)
      try {
        const progressRes = await getPersistedKpiProgress(id);
        const persistedProgress = progressRes.rows || [];

        if (persistedProgress.length > 0) {
          // Merge persisted progress with KPI metadata. kpi_progress rows store
          // completion_rate (approved submissions / participants); the weight
          // lives on the KPI itself, and linked session/doc counts are derived
          // from the curriculum (they are not cached).
          const sessionList = sesRes.rows || [];
          const docList = docRes.rows || [];
          kpisWithProgress = kpiList.map((kpi) => {
            const p = persistedProgress.find(
              (pp) => String(pp.kpi_id) === String(kpi.id),
            );
            const linkedSessions = sessionList.filter((s) => {
              try {
                const ids =
                  typeof s.kpi_ids === "string"
                    ? JSON.parse(s.kpi_ids)
                    : s.kpi_ids || [];
                return ids.map(String).includes(String(kpi.id));
              } catch {
                return false;
              }
            });
            const linkedDocs = docList.filter((d) => {
              try {
                const ids =
                  typeof d.kpi_ids === "string"
                    ? JSON.parse(d.kpi_ids)
                    : d.kpi_ids || [];
                return ids.map(String).includes(String(kpi.id));
              } catch {
                return false;
              }
            });
            return {
              ...kpi,
              progress: p
                ? Math.round(parseFloat(p.completion_rate) || 0)
                : 0,
              weight:
                parseFloat(kpi.weight) ||
                (kpiList.length > 0 ? Math.round(100 / kpiList.length) : 0),
              linkedSessions: linkedSessions.length,
              completedSessions: linkedSessions.filter(
                (s) => s.status === "completed",
              ).length,
              linkedDocs: linkedDocs.length,
              completedDocs: linkedDocs.filter((d) => d.is_completed).length,
            };
          });
        } else {
          // Fallback: calculate dynamically (first time, no persisted data yet)
          const sessionList = sesRes.rows || [];
          const docList = docRes.rows || [];

          kpisWithProgress = kpiList.map((kpi) => {
            const kpiId = String(kpi.id);
            const linkedSessions = sessionList.filter((s) => {
              try {
                const ids =
                  typeof s.kpi_ids === "string"
                    ? JSON.parse(s.kpi_ids)
                    : s.kpi_ids || [];
                return ids.map(String).includes(kpiId);
              } catch {
                return false;
              }
            });
            const linkedDocs = docList.filter((d) => {
              try {
                const ids =
                  typeof d.kpi_ids === "string"
                    ? JSON.parse(d.kpi_ids)
                    : d.kpi_ids || [];
                return ids.map(String).includes(kpiId);
              } catch {
                return false;
              }
            });

            return {
              ...kpi,
              progress:
                linkedSessions.length + linkedDocs.length > 0
                  ? Math.round(
                      ((linkedSessions.filter((s) => s.status === "completed")
                        .length +
                        linkedDocs.filter((d) => d.is_completed).length) /
                        (linkedSessions.length + linkedDocs.length)) *
                        100,
                    )
                  : 0,
              weight:
                parseFloat(kpi.weight) ||
                (kpiList.length > 0 ? Math.round(100 / kpiList.length) : 0),
              linkedSessions: linkedSessions.length,
              completedSessions: linkedSessions.filter(
                (s) => s.status === "completed",
              ).length,
              linkedDocs: linkedDocs.length,
              completedDocs: linkedDocs.filter((d) => d.is_completed).length,
            };
          });

          // Fire-and-forget: persist this calculation for next time
          recalculateKpiProgress(id).catch(() => {});
        }
      } catch (e) {
        console.warn(
          "kpi_progress table not available, falling back to dynamic calc:",
          e.message,
        );
        // Fallback: calculate dynamically
        const sessionList = sesRes.rows || [];
        const docList = docRes.rows || [];
        kpisWithProgress = kpiList.map((kpi) => {
          const kpiId = String(kpi.id);
          const linkedSessions = sessionList.filter((s) => {
            try {
              const ids =
                typeof s.kpi_ids === "string"
                  ? JSON.parse(s.kpi_ids)
                  : s.kpi_ids || [];
              return ids.map(String).includes(kpiId);
            } catch {
              return false;
            }
          });
          const linkedDocs = docList.filter((d) => {
            try {
              const ids =
                typeof d.kpi_ids === "string"
                  ? JSON.parse(d.kpi_ids)
                  : d.kpi_ids || [];
              return ids.map(String).includes(kpiId);
            } catch {
              return false;
            }
          });
          return {
            ...kpi,
            progress:
              linkedSessions.length + linkedDocs.length > 0
                ? Math.round(
                    ((linkedSessions.filter((s) => s.status === "completed")
                      .length +
                      linkedDocs.filter((d) => d.is_completed).length) /
                      (linkedSessions.length + linkedDocs.length)) *
                      100,
                  )
                : 0,
            weight:
              parseFloat(kpi.weight) ||
              (kpiList.length > 0 ? Math.round(100 / kpiList.length) : 0),
            linkedSessions: linkedSessions.length,
            completedSessions: linkedSessions.filter(
              (s) => s.status === "completed",
            ).length,
            linkedDocs: linkedDocs.length,
            completedDocs: linkedDocs.filter((d) => d.is_completed).length,
          };
        });
      }

      totalParticipants = uniqueParticipants.length;
      const docList = docRes.rows || [];
      expectedSubmissions = totalParticipants * docList.length;
      actualSubmissions = subList.length;
      approvedSubmissions = subList.filter(
        (s) => s.status === "approved",
      ).length;
      submissionRate =
        expectedSubmissions > 0
          ? Math.round((actualSubmissions / expectedSubmissions) * 100)
          : 0;
      approvalRate =
        actualSubmissions > 0
          ? Math.round((approvedSubmissions / actualSubmissions) * 100)
          : 0;
      operationalProgress =
        kpisWithProgress.length > 0
          ? Math.round(
              kpisWithProgress.reduce((sum, k) => sum + (k.progress || 0), 0) /
                kpisWithProgress.length,
            )
          : program?.completion_index || 0;
      overallHealth = Math.round((operationalProgress + approvalRate) / 2);
    }

    return NextResponse.json({
      success: true,
      program,
      participants: uniqueParticipants,
      teams: teamRes.rows,
      sessions: sesRes.rows,
      staffList: staffRes.rows,
      events: eventRes.rows,
      kpis: kpisWithProgress,
      documents: docRes.rows,
      followups: folRes.rows,
      assignedStaff,
      facilitators: programFacilitators,
      submissions: subRes.rows,
      reports: repRes.rows,
      families: famRes.rows,
      deliverables: delRes.rows,
      metrics: includeMetrics
        ? {
            operational: {
              progress: operationalProgress,
              kpis: kpisWithProgress.map((k) => ({
                id: k.id,
                title: k.title,
                progress: k.progress,
                weight: k.weight,
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
