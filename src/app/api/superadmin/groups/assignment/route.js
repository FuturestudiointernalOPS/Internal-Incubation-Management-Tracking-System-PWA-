import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import {
  getV2ProgramById,
  updateContactsProgramAssignment,
  getAssignmentContactsByGroupName,
  upsertV2ParticipantActiveWithFallback,
  insertParticipantProgramMembership,
} from "@/models/groups";

export const POST = createHandler({ roles: ["super_admin"] }, async (req) => {
  const { group_name, program_id, program_name } = await req.json();

  if (!group_name || !program_id) {
    return NextResponse.json(
      { success: false, error: "Group name and Program ID required" },
      { status: 400 },
    );
  }

  // Verify the program exists in v2_programs before assigning
  const progCheck = await getV2ProgramById(program_id);
  if (progCheck.rows.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Program "${program_id}" not found. Create the program first before assigning.`,
      },
      { status: 404 },
    );
  }

  // Update all contacts in the group with the program_id (case-insensitive:
  // group names are normalized to UPPERCASE in contacts).
  await updateContactsProgramAssignment(program_id, program_name, group_name);

  // Also update v2_participants if they exist for these contacts
  const contactsRes = await getAssignmentContactsByGroupName(group_name);

  for (const contact of contactsRes.rows) {
    await upsertV2ParticipantActiveWithFallback(
      program_id,
      contact.name,
      contact.email,
      contact.phone,
    );

    // Sync participant_programs junction table
    if (contact.cid) {
      try {
        // Same-program conflict guard (Phase 2A).
        const conflictError = await assertNoParticipantFacilitatorConflict(
          program_id,
          contact.cid,
          contact.email || null,
        );
        if (conflictError) continue;
        await insertParticipantProgramMembership(contact.cid, program_id);
      } catch (_) {
        // participant_programs table may not exist
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: `Assigned ${contactsRes.rows.length} contacts to program.`,
  });
});
