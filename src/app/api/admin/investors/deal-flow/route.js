import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireAuthorization } from "@/models/authorization/index";
import {
  createDealFlowEntry,
  addDeck,
  publishDeck,
  changeDealFlowStatus,
  listDealFlowForStudio,
} from "@/services/investor/dealFlow";

/**
 * Studio management of deal flow (Super Admin / delegated `investor.*` holders).
 *   GET  ?status=            list entries
 *   POST { venture_id, target_amount, currency, instrument?, use_of_funds? }
 *   PUT  { action: "add_deck" | "publish_deck" | status change }
 */
export async function GET(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;

    const status = new URL(req.url).searchParams.get("status") || undefined;
    const result = await listDealFlowForStudio({ status });
    return NextResponse.json({ success: true, entries: result.entries });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "create");
    if (authError) return authError;

    const body = await req.json();
    const result = await createDealFlowEntry({ ...body, session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, entry: result.entry });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const body = await req.json();
    const session = await getSession();

    if (body.action === "add_deck") {
      const result = await addDeck({
        dealFlowEntryId: body.deal_flow_entry_id,
        fileRef: body.file_ref,
        fileName: body.file_name,
        mimeType: body.mime_type,
        session,
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, deck: result.deck });
    }

    if (body.action === "publish_deck") {
      const result = await publishDeck({ deckId: body.deck_id, session });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, deck: result.deck });
    }

    const result = await changeDealFlowStatus({
      id: body.id,
      status: body.status,
      closeReason: body.close_reason,
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, entry: result.entry });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
