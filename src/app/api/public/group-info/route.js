import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { buildPublicGroupInfo } from "@/services/lms";

/**
 * PUBLIC endpoint — no auth required.
 * GET /api/public/group-info?id=X
 * Returns group name + program_id + registration window for registration page.
 *
 * The group resolution (families → v2_groups) and the registration-window
 * lookup live in `@/services/lms`.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const result = await buildPublicGroupInfo({ groupId: id });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ group: result.group });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
