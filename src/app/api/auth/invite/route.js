import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  { roles: ["super_admin", "program_manager"] },
  async (req) => {
    const {
      cid,
      email,
      name,
      role,
      invitedBy,
      groupId,
      tokenType = "staff_invite",
    } = await req.json();

    if (!cid || !email || !name) {
      return NextResponse.json(
        { success: false, error: "cid, email, and name are required" },
        { status: 400 },
      );
    }

    const token = uuidv4();

    await db.execute({
      sql: `INSERT INTO password_setup_tokens (token, user_cid, token_type, invited_by, role, group_id, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL '48 hours')`,
      args: [
        token,
        cid,
        tokenType,
        invitedBy || null,
        role || null,
        groupId || null,
      ],
    });

    await db.execute({
      sql: "UPDATE contacts SET invited_at = NOW() WHERE cid = ?",
      args: [cid],
    });

    sendInviteEmail({ to: email, name, role, token }).catch((e) =>
      console.error("Invite email failed:", e),
    );

    return NextResponse.json({ success: true, message: "Invite sent", token });
  },
);
