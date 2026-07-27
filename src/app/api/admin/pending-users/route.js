import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { NextResponse } from "next/server";

export const GET = createHandler({ roles: ["super_admin"] }, async () => {
  const result = await db.execute({
    sql: `SELECT cid, name, email, phone, group_name, role, created_at, program_name, gender FROM contacts WHERE status = 'pending' AND deleted = 0 AND deleted_at IS NULL ORDER BY created_at DESC`,
    args: [],
  });

  const pendingUsers = result.rows;
  const grouped = {};
  for (const user of pendingUsers) {
    const group = user.group_name || "UNASSIGNED";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(user);
  }

  return NextResponse.json({
    success: true,
    total: pendingUsers.length,
    pendingUsers,
    grouped,
  });
});
