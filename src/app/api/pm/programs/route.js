import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, getSession, assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { logAuditEvent } from "@/lib/audit";
import {
  addParticipantToProgram,
  addProgramExpectedOutcomesColumn,
  addProgramSlugColumn,
  addProgramSuccessMetricsColumn,
  assignSegmentById,
  assignSegmentByName,
  autoActivatePlannedPrograms,
  countActiveParticipantsByProgram,
  countDocumentRequirementsByProgram,
  countProtectedProgramData,
  countReportWeeksByProgram,
  countSessionsByProgram,
  countSubmissionsByProgram,
  createProgram,
  createProgramKpi,
  createSystemFacilitatorsGroup,
  deleteProgramById,
  findProgramByExactName,
  getAssignedFamiliesByProgram,
  getContactsByFamilyGroupName,
  getProgramFacilitators,
  getProgramWithAssignedPm,
  getSegmentFamilyName,
  linkSegmentById,
  linkSegmentByName,
  listProgramsByManagementFilters,
  setProgramArchiveState,
  unlinkSegmentsFromProgram,
  updateProgram,
} from "@/models/programs";
export const dynamic = "force-dynamic";

/**
 * PROGRAMS API — OPERATIONAL INTELLIGENCE
 * Handles program lifecycle, completion metrics, and resource association.
 */

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
    const session = await getSession();
    const url = new URL(req.url);
    const assignedPmId = url.searchParams.get("assigned_pm_id");
    const showArchivedRaw = url.searchParams.get("show_archived");
    const status = url.searchParams.get("status");
    const showAll = showArchivedRaw === "all";
    const showArchived = showArchivedRaw === "true";

    // Auto-activate programs where start_date has passed (gracefully fail if columns missing)
    try {
      await autoActivatePlannedPrograms();
    } catch (_) {}

    const programsRes = await listProgramsByManagementFilters({
      showAll,
      showArchived,
      status,
      assignedPmId,
      session,
    });
    const programs = programsRes.rows;

    if (programs.length === 0) {
      return NextResponse.json({ success: true, programs: [] });
    }

    // 2. Fetch Aggregate Metrics (Grouped)
    const [sessions, participants, docs, reports, segments, submissions] =
      await Promise.all([
        countSessionsByProgram(),
        countActiveParticipantsByProgram(),
        countDocumentRequirementsByProgram(),
        countReportWeeksByProgram(),
        getAssignedFamiliesByProgram(),
        countSubmissionsByProgram(),
      ]);

    // Map metrics for O(1) lookup
    const metrics = {
      sessions: Object.fromEntries(sessions.rows.map((r) => [r.program_id, r])),
      participants: Object.fromEntries(
        participants.rows.map((r) => [r.program_id, r.count]),
      ),
      docs: Object.fromEntries(docs.rows.map((r) => [r.program_id, r])),
      reports: Object.fromEntries(
        reports.rows.map((r) => [r.program_id, r.weeks]),
      ),
      segments: segments.rows.reduce((acc, r) => {
        if (!acc[r.program_id]) acc[r.program_id] = [];
        acc[r.program_id].push(r.id);
        return acc;
      }, {}),
      submissions: Object.fromEntries(
        submissions.rows.map((r) => [r.program_id, r]),
      ),
    };

    // 3. Assemble Final Data
    const enrichedPrograms = await Promise.all(
      programs.map(async (p) => {
      const s = metrics.sessions[p.id] || { count: 0, completed: 0 };
      const d = metrics.docs[p.id] || { count: 0, completed: 0 };
      const r_weeks = metrics.reports[p.id] || 0;
      const sub = metrics.submissions[p.id] || { total: 0, approved: 0 };

      // Calculate Completion Index in JS to offload DB
      const sessionsWeight = s.completed * 5.0;
      const docsWeight = d.completed * 2.0;
      const reportsWeight = r_weeks * 10.0;
      const submissionsWeight = sub.approved * 3.0;

      const duration = Number(p.duration_weeks) || 4;
      const totalPossibleWeight =
        s.count * 5.0 +
        d.count * 2.0 +
        duration * 10.0 +
        d.count * Number(p.participants_count || 1) * 3.0;
      const completion_index =
        totalPossibleWeight > 0
          ? ((sessionsWeight + docsWeight + reportsWeight + submissionsWeight) /
              totalPossibleWeight) *
            100
          : 0;

      // Program facilitators (external personnel, role='facilitator')
      let facilitators = [];
      try {
        const facRes = await getProgramFacilitators(p.id);
        facilitators = facRes.rows.map((r) => {
          let perms = r.permissions || {};
          if (typeof perms === "string") {
            try { perms = JSON.parse(perms); } catch { perms = {}; }
          }
          return {
            id: r.id,
            cid: r.staff_id,
            role: r.role || "facilitator",
            permissions: perms,
            name: r.name || r.email || r.staff_id,
            email: r.email || r.staff_id,
          };
        });
      } catch (_) {}

      // Parse facilitator default permissions defensively
      let fdp = p.facilitator_default_permissions || {};
      if (typeof fdp === "string") {
        try { fdp = JSON.parse(fdp); } catch { fdp = {}; }
      }

      return {
        ...p,
        sessions_count: s.count,
        participants_count: metrics.participants[p.id] || 0,
        docs_total: d.count,
        docs_completed: d.completed,
        reports_count: r_weeks,
        completion_index: Math.round(completion_index),
        assigned_segments: metrics.segments[p.id] || [],
        submissions_total: sub.total,
        submissions_approved: sub.approved,
        facilitators,
        facilitator_default_permissions: fdp,
        facilitator_scope: p.facilitator_scope || "assigned_groups",
      };
    }),
    );

    return NextResponse.json({ success: true, programs: enrichedPrograms });
  } catch (error) {
    console.error("GET Programs Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    // Phase 2 (legacy cleanup): no more staff compatibility bypass — program
    // creation requires the programs.create capability through the resolver.
    const capError = await requireAuthorization("programs", "create");
    if (capError) return capError;
    const {
      name,
      description,
      concept_note,
      vision,
      objectives,
      program_type,
      visibility,
      language,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      materials,
      start_date,
      end_date,
      assigned_segments,
      kpis,
      expected_outcomes,
      success_metrics,
    } = await req.json();
    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100) + '-' + id.substring(0, 8);

    // Ensure new columns exist
    try { await addProgramSlugColumn(); } catch(_) {}
    try { await addProgramExpectedOutcomesColumn(); } catch(_) {}
    try { await addProgramSuccessMetricsColumn(); } catch(_) {}

    // B6: Check duplicate program name
    const existing = await findProgramByExactName(name);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "A program with this name already exists." },
        { status: 409 },
      );
    }

    // Prevent start date in the past
    if (start_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(start_date) < today) {
        return NextResponse.json(
          { success: false, error: "Start date cannot be in the past." },
          { status: 400 },
        );
      }
    }

    // Prevent end date before start date
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { success: false, error: "End date cannot be earlier than start date." },
        { status: 400 },
      );
    }

    await createProgram({
      id,
      name,
      slug,
      description,
      concept_note,
      vision,
      objectives,
      expected_outcomes,
      success_metrics,
      program_type,
      visibility,
      language,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      materials,
      start_date,
      end_date,
    });

      // Auto-create the system-defined Facilitators group for this program
      try {
        await createSystemFacilitatorsGroup(programId);
      } catch (_) {}
    // Handle Segment/Team Assignments for new program
    if (Array.isArray(assigned_segments) && assigned_segments.length > 0) {
      for (const segmentId of assigned_segments) {
        if (!segmentId) continue;
        const sid = !isNaN(segmentId) ? Number(segmentId) : null;
        if (sid !== null) {
          await assignSegmentById(id, sid);
        } else {
          await assignSegmentByName(id, segmentId);
        }
      }
    }

    // Handle KPIs — auto-populate defaults if none provided
    const DEFAULT_KPIS = [
      { title: "Attendance Rate", target_value: 80 },
      { title: "Assignment Completion", target_value: 80 },
      { title: "Session Participation", target_value: 80 },
      { title: "Team Engagement", target_value: 80 },
      { title: "Coaching Completion", target_value: 80 },
      { title: "Graduation Rate", target_value: 80 },
    ];
    const kpisToCreate = (Array.isArray(kpis) && kpis.length > 0) ? kpis : DEFAULT_KPIS;
    for (const kpi of kpisToCreate) {
      if (!kpi.title) continue;
      await createProgramKpi(id, kpi.title, kpi.target_value);
    }

    // B10: Audit log
    const session = await getSession();
    await logAuditEvent({
      entity_type: "program",
      entity_id: id,
      user_id: session?.user_cid || "system",
      user_name: session?.name || "System",
      action: "created",
      details: `Program "${name}" created`,
    });

    // B11: Notification PM assignment
    if (assigned_pm_id) {
      await logAuditEvent({
        entity_type: "program_assignment",
        entity_id: id,
        user_id: assigned_pm_id,
        user_name: name,
        action: "assigned",
        details: `You have been assigned as Program Manager for "${name}"`,
      });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("POST Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "admin",
    ]);
    if (authError) return authError;
    // Phase 2 (legacy cleanup): no more staff/teacher/admin compatibility
    // bypass — program editing requires the programs.edit capability through
    // the resolver (eligibility boundary included). PMs hold it via their
    // profile; plain staff without it are denied (intended model).
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;
    const {
      id,
      name,
      description,
      concept_note,
      vision,
      objectives,
      expected_outcomes,
      success_metrics,
      program_type,
      visibility,
      language,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      status,
      materials,
      assigned_segments,
      start_date,
      end_date,
      grading_mode,
      is_archived,
      facilitator_default_permissions,
      facilitator_scope,
    } = await req.json();

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    // Verify the program exists before updating or assigning
    const progExists = await getProgramWithAssignedPm(id);
    if (progExists.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Program "${id}" not found.` },
        { status: 404 },
      );
    }

    // Name required for non-archive updates
    if (!name && is_archived === undefined) {
      return NextResponse.json(
        { success: false, error: "Name required" },
        { status: 400 },
      );
    }

    // If is_archived is provided without a name, it's a quick archive action
    if (is_archived !== undefined && !name) {
      const newStatus = is_archived ? "archived" : "active";
      await setProgramArchiveState(is_archived, newStatus, id);
      return NextResponse.json({ success: true });
    }

    // Prevent end date before start date
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { success: false, error: "End date cannot be earlier than start date." },
        { status: 400 },
      );
    }

    // Sync status: if setting to archived, also mark is_archived
    const finalIsArchived = status === "archived" ? 1 : 0;

    await updateProgram({
      id,
      name,
      description,
      concept_note,
      vision,
      objectives,
      expected_outcomes,
      success_metrics,
      program_type,
      visibility,
      language,
      note_id,
      assigned_pm_id,
      assigned_assistant_id,
      duration_weeks,
      status,
      is_archived: finalIsArchived,
      materials,
      start_date,
      end_date,
      grading_mode,
      facilitator_default_permissions,
      facilitator_scope,
    });

    // B10: Audit log
    const session = await getSession();
    await logAuditEvent({
      entity_type: "program",
      entity_id: id,
      user_id: session?.user_cid || "system",
      user_name: session?.name || "System",
      action: "updated",
      details: `Program "${name}" updated`,
    });

    // B11: Notification PM assignment — only log when the PM actually changes
    const previousPmId = progExists.rows[0]?.assigned_pm_id;
    if (assigned_pm_id && String(assigned_pm_id) !== String(previousPmId)) {
      await logAuditEvent({
        entity_type: "program_assignment",
        entity_id: id,
        user_id: assigned_pm_id,
        user_name: name,
        action: "assigned",
        details: `You have been assigned as Program Manager for "${name}"`,
      });
    }

    // Handle Segment/Team Assignments
    if (Array.isArray(assigned_segments)) {
      // 1. Unlink segments currently assigned to this program
      // Guard: skip if program_id column has legacy non-UUID values
      try {
        await unlinkSegmentsFromProgram(id);
      } catch (e) { console.warn("[programs] Could not unlink families segments:", e.message); }

      // 2. Link the new set of segments
      if (assigned_segments.length > 0) {
        for (const segmentId of assigned_segments) {
          if (!segmentId) continue;
          const sid = !isNaN(segmentId) ? Number(segmentId) : null;
          let familyName = "";

          if (sid !== null) {
            try {
              await linkSegmentById(id, sid);
            } catch (e) { console.warn("[programs] Could not link family by id:", e.message); }
            const fRes = await getSegmentFamilyName(sid);
            if (fRes.rows && fRes.rows.length > 0) {
              familyName = fRes.rows[0].name;
            }
          } else {
            try {
              await linkSegmentByName(id, segmentId);
            } catch (e) { console.warn("[programs] Could not link family by name:", e.message); }
            familyName = segmentId;
          }

          // 3. Sync participant_programs for the new program assignment.
          //    (Phase 3: legacy contacts.program_id and v2_participants writes
          //    removed; participant_programs is now authoritative.)
          if (familyName) {
            const contactsRes = await getContactsByFamilyGroupName(familyName);

            if (contactsRes.rows && contactsRes.rows.length > 0) {
              for (const contact of contactsRes.rows) {
                const cCid = contact.cid;
                if (!cCid) continue;
                // Same-program conflict guard (Phase 2A).
                const conflictError = await assertNoParticipantFacilitatorConflict(
                  id,
                  cCid,
                  contact.email || null,
                );
                if (conflictError) continue;
                try {
                  await addParticipantToProgram(cCid, id);
                } catch (_) {
                  // participant_programs table may not exist
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("programs", "delete");
    if (capError) return capError;

    const { id } = await req.json();

    if (!id)
      return NextResponse.json(
        { success: false, error: "ID required" },
        { status: 400 },
      );

    // Phase 3C-7: refuse permanent deletion when the program carries protected
    // historical data (participants, sessions, submissions, deliverables).
    // Server-side enforcement — instruct to archive instead.
    const protectedRes = await countProtectedProgramData(id);
    if (Number(protectedRes.rows[0]?.protected_count || 0) > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Program contains protected data (participants, sessions, submissions, or deliverables). Archive it instead of deleting.",
        },
        { status: 409 },
      );
    }

    await deleteProgramById(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
