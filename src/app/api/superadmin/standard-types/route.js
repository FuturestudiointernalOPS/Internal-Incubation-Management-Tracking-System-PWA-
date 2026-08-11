import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

const ROLE = { roles: ['super_admin'] };

export const GET = createHandler(ROLE, async (req) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  let query = "SELECT * FROM v2_standard_types WHERE status = 'active'";
  let args = [];

  if (category) {
    query += " AND description = ?";
    args.push(category);
  }

  const res = await db.execute({ sql: query, args });
  return NextResponse.json({ success: true, types: res.rows });
});

export const POST = createHandler(ROLE, async (req) => {
  const { category, label, id } = await req.json();
  if (id) {
    await db.execute({
      sql: "UPDATE v2_standard_types SET name = ? WHERE id = ?",
      args: [label, id],
    });
  } else {
    await db.execute({
      sql: "INSERT INTO v2_standard_types (name, description) VALUES (?, ?)",
      args: [label, category],
    });
  }
  return NextResponse.json({ success: true });
});

export const DELETE = createHandler(ROLE, async (req) => {
  const { id } = await req.json();
  await db.execute({
    sql: "DELETE FROM v2_standard_types WHERE id = ?",
    args: [id],
  });
  return NextResponse.json({ success: true });
});
