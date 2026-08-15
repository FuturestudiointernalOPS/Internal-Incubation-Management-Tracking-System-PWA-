import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProgramHistory } from "@/lib/program-history";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[cid]/programs
 *
 * Returns a specific contact's program engagements (participant / facilitator /
 * program manager / assistant) for the CRM Contact view. Read-only, derived
 * from existing tables.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "program_manager",
      "staff",
    ]);
    if (authError) return authError;

    const { cid } = await params;
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    const contactRes = await db.execute({
      sql: "SELECT email FROM contacts WHERE cid = ? LIMIT 1",
      args: [cid],
    });
    const email = contactRes.rows[0]?.email || "";

    const history = await getProgramHistory({ cid, email });

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("[Contact programs] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
