import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/invite-family
 *
 * Invites multiple family/group members. Each member gets their own
 * individual contact record and activation link.
 *
 * Body: { familyId, familyName, groupName, programId, emails: [] }
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;

    const { familyId, familyName, groupName, programId, emails } =
      await req.json();

    if (!familyId || !emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: "familyId and emails array are required" },
        { status: 400 },
      );
    }

    // Verify the program exists if programId is provided
    if (programId) {
      const progCheck = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE id = ?",
        args: [programId],
      });
      if (progCheck.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Program "${programId}" not found. Create it first before inviting.`,
          },
          { status: 404 },
        );
      }
    }

    const results = [];

    for (const item of emails) {
      const memberEmail = typeof item === "string" ? item : item.email;
      const memberName = item.name || memberEmail.split("@")[0];

      if (!memberEmail) continue;

      try {
        // Create contact for this member
        const cid = `USER_${uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12)}`;

        await db.execute({
          sql: "INSERT INTO contacts (cid, name, email, role, status, group_name, program_id, invited_at) VALUES (?, ?, ?, 'participant', 'pending', ?, ?, NOW())",
          args: [
            cid,
            memberName,
            memberEmail,
            groupName || familyName || "",
            programId || null,
          ],
        });

        // Sync participant_programs junction table if programId is provided
        if (programId) {
          try {
            await db.execute({
              sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
              args: [cid, programId, "system", "family_invite"],
            });
          } catch (_) {
            // participant_programs table may not exist
          }
        }

        // Generate invite token
        const token = uuidv4();
        await db.execute({
          sql: "INSERT INTO password_setup_tokens (token, user_cid, token_type, role, group_id, expires_at) VALUES (?, ?, 'family_invite', 'participant', ?, NOW() + INTERVAL '48 hours')",
          args: [token, cid, familyId],
        });

        // Send email
        sendInviteEmail({
          to: memberEmail,
          name: memberName,
          role: "participant",
          token,
        }).catch((e) => console.error("Family invite email failed:", e));

        results.push({
          email: memberEmail,
          name: memberName,
          status: "invited",
          cid,
        });
      } catch (e) {
        results.push({
          email: memberEmail,
          status: "failed",
          error: e.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.filter((r) => r.status === "invited").length} invites sent`,
      results,
    });
  } catch (error) {
    console.error("Invite family error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
