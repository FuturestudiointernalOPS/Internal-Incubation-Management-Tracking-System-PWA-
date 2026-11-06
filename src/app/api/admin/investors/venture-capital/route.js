import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorStudioAuthorization as requireAuthorization } from "@/server/investor/studioAuthorization";
import { listCapitalInputs, saveCapitalInput } from "@/services/investor/studioCapital";

/** GET /api/admin/investors/venture-capital — the studio's capital inputs. */
export async function GET() {
  try {
    await initDb();

    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;
    await ensureInvestorExpansionSchema();

    const result = await listCapitalInputs();
    return NextResponse.json({ success: true, inputs: result.inputs });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PUT — upsert one venture's studio capital / valuation / exit inputs. */
export async function PUT(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const payload = await req.json();
    const result = await saveCapitalInput({ payload, session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, input: result.input });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
