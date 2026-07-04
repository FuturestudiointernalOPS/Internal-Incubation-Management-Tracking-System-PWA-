import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { cid } = await params;
    const contactRes = await db.execute({
      sql: "SELECT cid FROM contacts WHERE cid = ?",
      args: [cid],
    });
    if (contactRes.rows.length === 0)
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    await db.execute({
      sql: "UPDATE contacts SET status = 'inactive' WHERE cid = ?",
      args: [cid],
    });
    await db.execute({
      sql: "DELETE FROM user_sessions WHERE user_cid = ?",
      args: [cid],
    });
    return NextResponse.json({
      success: true,
      message: "Access revoked. User sessions destroyed.",
    });
  },
);
