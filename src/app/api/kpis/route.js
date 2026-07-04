import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("program_id");
  const result = await db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
    args: [programId],
  });
  return NextResponse.json({ success: true, kpis: result.rows });
});

export const POST = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {
  const { program_id, title, target_value } = await req.json();
  const result = await db.execute({
    sql: "INSERT INTO v2_kpis (program_id, title, target_value) VALUES (?, ?, ?) RETURNING id, title, target_value",
    args: [program_id, title, target_value],
  });
  return NextResponse.json({ success: true, kpi: result.rows[0] });
});

export const PUT = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {
  const { id, title, target_value } = await req.json();
  await db.execute({
    sql: "UPDATE v2_kpis SET title = ?, target_value = ? WHERE id = ?",
    args: [title, target_value, id],
  });
  return NextResponse.json({ success: true });
});

export const DELETE = createHandler({ roles: ["staff", "super_admin"] }, async (req) => {
  const { id } = await req.json();
  await db.execute({
    sql: "DELETE FROM v2_kpis WHERE id = ?",
    args: [id],
  });
  return NextResponse.json({ success: true });
});
