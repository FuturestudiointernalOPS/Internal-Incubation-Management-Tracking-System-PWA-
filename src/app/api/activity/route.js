import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(
  { roles: ["staff", "super_admin"] },
  async () => {
    const result = await db.execute(
      `SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100`,
    );
    return NextResponse.json({ success: true, activity: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { user, action } = await req.json();
    await db.execute({
      sql: "INSERT INTO activity_logs (user_identity, action) VALUES (?, ?)",
      args: [user || "System", action],
    });
    return NextResponse.json({ success: true });
  },
);
