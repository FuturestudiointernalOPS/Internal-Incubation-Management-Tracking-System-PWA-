import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { v4 as uuidv4 } from "uuid";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { cid } = await params;
    const contactRes = await db.execute({
      sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0)
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    const contact = contactRes.rows[0];
    const token = uuidv4();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/activate?token=${token}&mode=reset`;
    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, contact_cid, token_type, expires_at) VALUES (?, ?, 'password_reset', NOW() + INTERVAL '48 hours')",
      args: [token, cid],
    });
    sendPasswordResetEmail({
      to: contact.email,
      name: contact.name,
      resetUrl,
    }).catch((e) => console.error("Password reset email failed:", e));
    return NextResponse.json({
      success: true,
      message: "Password reset email sent",
    });
  },
);
