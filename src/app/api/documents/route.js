import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const result = await db.execute({
      sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
      args: [programId],
    });
    return NextResponse.json({ success: true, documents: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { program_id, title, description, resource_url, resource_label } = await req.json();
    const result = await db.execute({
      sql: "INSERT INTO v2_document_requirements (program_id, title, description, resource_url, resource_label) VALUES (?, ?, ?, ?, ?) RETURNING *",
      args: [program_id, title, description, resource_url || null, resource_label || null],
    });
    return NextResponse.json({ success: true, document: result.rows[0] });
  },
);
