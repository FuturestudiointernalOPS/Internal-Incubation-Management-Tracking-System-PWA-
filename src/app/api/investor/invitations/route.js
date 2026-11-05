import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireAuthorization } from "@/models/authorization/index";
import { createInvitation, listInvitationsForStudio } from "@/services/investor/invitations";

/** GET /api/investor/invitations?status= — studio list. */
export async function GET(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;

    const status = new URL(req.url).searchParams.get("status") || undefined;
    const result = await listInvitationsForStudio({ status });
    return NextResponse.json({ success: true, invitations: result.invitations });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/invitations  { email, name?, application_url? } */
export async function POST(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "create");
    if (authError) return authError;

    const { email, name, application_url } = await req.json();
    const result = await createInvitation({
      email,
      name,
      applicationUrl: application_url,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, invitation: result.invitation, link: result.link });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
