import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import {
  addParticipantProgramMembership,
  assignFamilyToProgram,
  createV2Program,
  ensureSystemFacilitatorsGroup,
  getAllPrograms,
  getContactsByFamilyName,
  getFamilyNameById,
  getProgramExists,
  unassignAllFamilies,
  unassignFamiliesNotInList,
  updateProgramFields,
} from "@/models/programs";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const {
      name,
      description,
      duration_weeks,
      duration_days,
      topics,
      outcomes,
      deliverables,
      resources,
      assigned_pm_id,
      feedback_enabled,
      grading_mode,
      evaluation_config,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Program name is required" },
        { status: 400 },
      );
    }

    const programId = `P-2026-${uuid4().slice(0, 8).toUpperCase()}`;

    await createV2Program({
      programId,
      name,
      description,
      duration_weeks,
      duration_days,
      topics,
      outcomes,
      deliverables,
      resources,
      assigned_pm_id,
      feedback_enabled,
      grading_mode,
      evaluation_config,
    });

      // Auto-create the system-defined Facilitators group for this program
      try {
        await ensureSystemFacilitatorsGroup(programId);
      } catch (_) {}
    return NextResponse.json({
      success: true,
      program: { id: programId, name, description },
    });
  } catch (error) {
    console.error("V2 Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { rows } = await getAllPrograms();

    // Parse JSON columns
    const programs = rows.map((r) => ({
      ...r,
      topics: r.topics ? JSON.parse(r.topics) : [],
      outcomes: r.outcomes ? JSON.parse(r.outcomes) : [],
      deliverables: r.deliverables ? JSON.parse(r.deliverables) : [],
      resources: r.resources ? JSON.parse(r.resources) : [],
      feedback_enabled: !!r.feedback_enabled,
    }));

    return NextResponse.json({ success: true, programs });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const data = await req.json();

    if (!data.id) {
      return NextResponse.json(
        { success: false, error: "Program ID is required for update." },
        { status: 400 },
      );
    }

    // Verify the program exists before updating or assigning
    const progExists = await getProgramExists(data.id);
    if (progExists.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Program "${data.id}" not found.` },
        { status: 404 },
      );
    }

    const fieldsToUpdate = [];
    const args = [];

    // Whitelist updatable fields
    const updatableColumns = [
      "name",
      "description",
      "duration_weeks",
      "duration_days",
      "topics",
      "outcomes",
      "deliverables",
      "resources",
      "assigned_pm_id",
      "manager_name",
      "document_title",
      "document_id",
      "feedback_enabled",
      "status",
      "grading_mode",
      "evaluation_config",
    ];

    for (const col of updatableColumns) {
      if (data[col] !== undefined) {
        fieldsToUpdate.push(`${col} = ?`);

        if (["topics", "outcomes", "deliverables", "resources"].includes(col)) {
          args.push(JSON.stringify(data[col] || []));
        } else if (col === "feedback_enabled") {
          args.push(data[col] ? 1 : 0);
        } else if (col === "evaluation_config") {
          args.push(JSON.stringify(data[col] || {}));
        } else {
          args.push(data[col]);
        }
      }
    }

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No fields to update.",
      });
    }

    // Add ID for the WHERE clause
    args.push(data.id);

    await updateProgramFields(fieldsToUpdate, args);

    // ─── PERSIST GROUP-TO-PROGRAM LINKAGE ───
    // assigned_segments is an array of family/group IDs to link to this program.
    if (Array.isArray(data.assigned_segments)) {
      const programId = data.id;
      const programName = data.name;

      // 1. Un-assign families no longer in the list
      if (data.assigned_segments.length > 0) {
        await unassignFamiliesNotInList(programId, data.assigned_segments);
      } else {
        await unassignAllFamilies(programId);
      }

      // 2. Assign selected families
      for (const familyId of data.assigned_segments) {
        await assignFamilyToProgram(programId, familyId);

        // 3. Update contacts in this family
        const familyRes = await getFamilyNameById(familyId);
        const familyName = familyRes.rows[0]?.name;
        if (familyName) {
          // Phase 1: participant_programs is the authoritative membership.
          // Legacy contacts.program_id/program_name and v2_participants writes
          // have been removed.
          const contactsRes = await getContactsByFamilyName(familyName);
          for (const contact of contactsRes.rows) {
            if (!contact.cid) continue;
            // Same-program conflict guard (Phase 2A).
            const conflictError = await assertNoParticipantFacilitatorConflict(
              programId,
              contact.cid,
              contact.email || null,
            );
            if (conflictError) continue;
            try {
              await addParticipantProgramMembership(contact.cid, programId);
            } catch (_) {
              // participant_programs table may not exist
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
