import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const body = await req.json();
    const { program_id, title, description, week_number } = body;

    if (!program_id || !title) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO v2_deliverables (program_id, title, description, week_number)
                 VALUES (?, ?, ?, ?) RETURNING id`,
            args: [
              program_id,
              title,
              description || null,
              week_number || 1,
            ],
    });

    return NextResponse.json({
      success: true,
      deliverable: {
              id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
              program_id,
              title,
              description,
              week_number,
            },
    });
  },
);

export const GET = createHandler(
  { roles: ["staff", "super_admin", "program_manager", "team", "participant"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    let sql = "SELECT * FROM v2_deliverables";
    let args = [];
    if (program_id) {
      sql += " WHERE program_id = ?";
      args.push(program_id);
    }
    sql += " ORDER BY week_number ASC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, deliverables: rows });
  },
);
