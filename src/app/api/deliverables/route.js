import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { createDeliverable, listDeliverables } from "@/models/facilitation";

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

    const result = await createDeliverable({ program_id, title, description, week_number });

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

    const { rows } = await listDeliverables(program_id);
    return NextResponse.json({ success: true, deliverables: rows });
  },
);
