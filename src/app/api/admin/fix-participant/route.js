import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  addParticipantProgramMembership,
  clearContactProgramId,
  findExistingParticipantSync,
  getContactByCid,
  getLatestProgram,
  insertV2Participant,
} from "@/models/adminOps";

/**
 * Temporary diagnostic/fix endpoint.
 * POST /api/admin/fix-participant
 * Assigns participant CID "USR-R25KDQIN" to the first available program.
 * Only accessible by super_admin.
 */
export async function POST() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const TARGET_CID = "USR-R25KDQIN";
    const results = [];

    // 1. Find the first program
    const progRes = await getLatestProgram();

    if (progRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No programs found. Create one first." },
        { status: 404 },
      );
    }

    const program = progRes.rows[0];
    results.push(`Found program: ${program.name} (${program.id})`);

    // 2. Find the participant
    const contactRes = await getContactByCid(TARGET_CID);

    if (contactRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Participant ${TARGET_CID} not found` },
        { status: 404 },
      );
    }

    const contact = contactRes.rows[0];
    results.push(
      `Found participant: ${contact.name} (${contact.cid}), current program_id: ${contact.program_id}`,
    );

    // 3. Insert into participant_programs
    try {
      await addParticipantProgramMembership(contact.cid, program.id);
      results.push(`Inserted into participant_programs`);
    } catch (e) {
      results.push(`participant_programs: ${e.message}`);
    }

    // 4. Clear invalid contacts.program_id
    await clearContactProgramId({ programName: program.name, contactCid: contact.cid });
    results.push(`Cleared contacts.program_id, set program_name`);

    // 5. Sync v2_participants
    try {
      const existing = await findExistingParticipantSync(contact.email, program.id);
      if (existing.rows.length === 0) {
        await insertV2Participant({
          programId: program.id,
          userCid: contact.cid,
          name: contact.name,
          email: contact.email,
        });
        results.push(`Synced v2_participants`);
      } else {
        results.push(`v2_participants already exists`);
      }
    } catch (e) {
      results.push(`v2_participants sync: ${e.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Participant assigned to program",
      results,
      program: { id: program.id, name: program.name },
      participant: { cid: contact.cid, name: contact.name },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
