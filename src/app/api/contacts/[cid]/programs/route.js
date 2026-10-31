import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { getProgramHistory } from "@/models/program-history";
import { getContactEmailForProgramHistory } from "@/models/programMembership";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[cid]/programs
 *
 * Returns a specific contact's program engagements (participant / facilitator /
 * program manager / assistant) for the CRM Contact view. Read-only, derived
 * from existing tables.
 *
 * Two rights are required: the person (contacts.view) AND the programme
 * (programs.view). The person record is the door; the programme history is
 * programme data, and a reader without that domain must not receive it.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const programError = await requireAuthorization("programs", "view");
    if (programError) return programError;

    const { cid } = await params;
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    const contactResult = await getContactEmailForProgramHistory(cid);
    const email = contactResult.rows[0]?.email || "";

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
