import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { openInvitation } from "@/services/investor/invitations";

/**
 * GET /api/investor/invitations/[token]
 *
 * Public: validates an invitation link and marks it opened. Returns only the
 * invited person's email/name — never the token or the hash.
 */
export async function GET(_req, { params }) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const { token } = await params;
    const result = await openInvitation({ token });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, invitation: result.invitation });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
