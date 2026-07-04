import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(async () => {
  const result = await db.execute({
    sql: "SELECT * FROM work_categories WHERE is_active = true ORDER BY sort_order ASC",
  });
  return NextResponse.json({ success: true, categories: result.rows });
});
