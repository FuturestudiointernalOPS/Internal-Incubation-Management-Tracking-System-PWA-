import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { createDeliverable, listDeliverables } from "@/models/facilitation";

export const POST = createHandler(
  async (req) => {
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;

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
  // Stays on a role list for now: the team ENTITY account (role "team") has no
  // profile, so no capability expresses it yet, and the team workspace reads
  // this list. Documented in docs/permissions/LOT4-STEP4-2C.md.
  { roles: ["staff", "super_admin", "program_manager", "team", "participant"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    const { rows } = await listDeliverables(program_id);
    return NextResponse.json({ success: true, deliverables: rows });
  },
);
