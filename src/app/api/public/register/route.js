import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { assertNoParticipantFacilitatorConflict } from "@/lib/auth";

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
    let groupResult = await db.execute({
      sql: "SELECT CAST(id AS TEXT) as id, name, program_id, registration_id FROM families WHERE registration_id = ? OR CAST(id AS TEXT) = ?",
      args: [group_id, group_id],
    });

    if (groupResult.rows.length === 0) {
      groupResult = await db.execute({
        sql: "SELECT CAST(id AS TEXT) as id, name, program_id, registration_id FROM v2_groups WHERE registration_id = ? OR CAST(id AS TEXT) = ?",
        args: [group_id, group_id],
      });
    }

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const group = groupResult.rows[0];

    // Check if contact already exists
    const normalizedEmail = email.trim().toLowerCase();
    const existCheck = await db.execute({
      sql: "SELECT cid FROM contacts WHERE email = ? AND deleted = 0",
      args: [normalizedEmail],
    });

    const cid = "USR-" + uuidv4().split("-")[0].toUpperCase();
    const hashedPassword = await bcrypt.hash(password, 12);

    if (existCheck.rows.length > 0) {
      // Update existing contact
      await db.execute({
        sql: "UPDATE contacts SET password = ?, name = ?, status = 'pending', group_name = ? WHERE email = ?",
        args: [hashedPassword, name, group.name, normalizedEmail],
      });
    } else {
      // Create new contact
      await db.execute({
        sql: "INSERT INTO contacts (cid, name, email, phone, password, role, status, group_name, created_at) VALUES (?, ?, ?, ?, ?, 'participant', 'pending', ?, NOW())",
        args: [cid, name, normalizedEmail, phone || null, hashedPassword, group.name],
      });
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
        await db.execute({
          sql: "INSERT INTO v2_participants (program_id, user_id, name, email, phone, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', NOW()) ON CONFLICT DO NOTHING",
          args: [group.program_id, contactCid, name, normalizedEmail, phone || null],
        });
        // Keep the canonical membership table (participant_programs) in sync so
        // group-link registrations show up in the Program Participants view once
        // the contact's account becomes active.
        await db.execute({
          sql: "INSERT INTO participant_programs (participant_id, program_id, status, accepted_at) VALUES (?, ?, 'pending', NOW()) ON CONFLICT (participant_id, program_id) DO NOTHING",
          args: [contactCid, group.program_id],
        });
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
