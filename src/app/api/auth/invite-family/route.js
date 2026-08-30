import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, assertNoParticipantFacilitatorConflict, getSession, isAssignedPmForProgram } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseEmailList } from "@/lib/email-utils";

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
    await ensureTokenHashColumns();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    // Rate limit: 10 bulk invite batches per IP per 10 minutes
    const limited = enforceRateLimit(req, `invite-family:ip:${getClientIp(req)}`, {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const session = await getSession();
    const { familyId, familyName, groupName, programId, emails } =
      await req.json();

    // Staff may only invite families for programs they are the assigned PM of.
    if (session?.role === "staff" && programId) {
      const isPm = await isAssignedPmForProgram(programId, session.cid);
      if (!isPm) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    if (!familyId) {
      return NextResponse.json(
        { success: false, error: "familyId is required" },
        { status: 400 },
      );
    }

    // Accept either an array or raw pasted text. Only valid email addresses
    // are kept; invalid tokens are ignored (reported as skipped).
    const emailList = parseEmailList(emails);
    if (emailList.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid email addresses provided" },
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

    for (const memberEmail of emailList) {
      const memberName = memberEmail.split("@")[0];

      try {
        // Create contact for this member
        const cid = `USER_${uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12)}`;

        await db.execute({
          sql: "INSERT INTO contacts (cid, name, email, role, status, group_name, program_id) VALUES (?, ?, ?, 'participant', 'pending', ?, ?)",
          args: [
            cid,
            memberName,
            memberEmail,
            groupName ? String(groupName || familyName || "").trim().toUpperCase() : null,
            programId || null,
          ],
        });

        // Sync participant_programs junction table if programId is provided
        if (programId) {
          try {
            // Same-program conflict guard (Phase 2A).
            const conflictError = await assertNoParticipantFacilitatorConflict(
              programId,
              cid,
              memberEmail,
            );
            if (conflictError) return conflictError;
            await db.execute({
              sql: `INSERT INTO participant_programs (participant_id, program_id)
                    VALUES (?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
              args: [cid, programId],
            });
          } catch (_) {
            // participant_programs table may not exist
          }
        }

        // Generate invite token
        const token = uuidv4();
        const tokenHash = hashToken(token);
        await db.execute({
          sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours')",
          args: [token, tokenHash, cid],
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
