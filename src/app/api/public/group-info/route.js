import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  findFamilyForGroupInfo,
  findV2GroupForGroupInfo,
  getProgramRegistrationWindow,
} from "@/models/platformConfig";

/**
 * PUBLIC endpoint — no auth required.
 * GET /api/public/group-info?id=X
 * Returns group name + program_id + registration window for registration page.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    let group = null;

    // Try families table first (by id OR registration_id)
    const result = await findFamilyForGroupInfo(id);

    if (result.rows.length > 0) {
      group = result.rows[0];
    }

    // Try v2_groups (by id OR registration_id)
    if (!group) {
      const v2GroupResult = await findV2GroupForGroupInfo(id);
      if (v2GroupResult.rows.length > 0) {
        group = v2GroupResult.rows[0];
      }
    }

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Fetch program registration window if program_id exists
    let registration_window = null;
    if (group.program_id) {
      const programResult = await getProgramRegistrationWindow(group.program_id);
      if (programResult.rows.length > 0) {
        registration_window = programResult.rows[0].registration_window;
      }
    }

    return NextResponse.json({ group: { ...group, registration_window } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
