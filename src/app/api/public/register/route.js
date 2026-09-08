import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import {
  findContactCidByEmail,
  findRegistrationGroupInFamilies,
  findRegistrationGroupInV2Groups,
  insertContactForRegistration,
  insertParticipantForRegistration,
  insertParticipantProgramMembership,
  updateContactForRegistration,
} from "@/models/platformConfig";

/**
 * PUBLIC endpoint — no auth required.
 * POST /api/public/register
 * Handles participant registration via public group link.
 */
export async function POST(req) {
  try {
    await initDb();
    const { name, email, password, phone, group_id } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Find the group in families or v2_groups
    let groupResult = await findRegistrationGroupInFamilies(group_id);

    if (groupResult.rows.length === 0) {
      groupResult = await findRegistrationGroupInV2Groups(group_id);
    }

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const group = groupResult.rows[0];

    // Check if contact already exists
    const normalizedEmail = email.trim().toLowerCase();
    const existCheck = await findContactCidByEmail(normalizedEmail);

    const cid = "USR-" + uuidv4().split("-")[0].toUpperCase();
    const hashedPassword = await bcrypt.hash(password, 12);

    if (existCheck.rows.length > 0) {
      // Update existing contact
      await updateContactForRegistration(hashedPassword, name, group, normalizedEmail);
    } else {
      // Create new contact
      await insertContactForRegistration(cid, name, normalizedEmail, phone, hashedPassword, group.name);
    }

    // Add participant to the program
    if (group.program_id) {
      try {
        const contactCid = existCheck.rows.length > 0 ? existCheck.rows[0].cid : cid;
        // Same-program conflict guard (Phase 2A): a facilitator in this program
        // cannot register as a participant in the same program.
        const conflictError = await assertNoParticipantFacilitatorConflict(
          group.program_id,
          contactCid,
          normalizedEmail,
        );
        if (conflictError) {
          return NextResponse.json(
            { success: false, error: "errors.roleConflictParticipantFacilitator", message: "You are already assigned as a facilitator in this program." },
            { status: 409 },
          );
        }
        await insertParticipantForRegistration(group.program_id, contactCid, name, normalizedEmail, phone);
        // Keep the canonical membership table (participant_programs) in sync so
        // group-link registrations show up in the Program Participants view once
        // the contact's account becomes active.
        await insertParticipantProgramMembership(contactCid, group.program_id);
      } catch (e) {
        console.warn("Failed to add participant:", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Application Submitted. Our team will review your application. If approved, you'll receive an email with your login instructions.",
      user: { cid: existCheck.rows.length > 0 ? existCheck.rows[0].cid : cid, name, email: normalizedEmail, role: "participant" },
    });
  } catch (error) {
    console.error("Public registration error:", error);
    return NextResponse.json({ error: "Registration failed. " + (error.message || "") }, { status: 500 });
  }
}
