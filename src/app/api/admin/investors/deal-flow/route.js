import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { removeInvestorDeckFile, uploadInvestorDeckFile } from "@/lib/investorDeckStorage";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorStudioAuthorization as requireAuthorization } from "@/server/investor/studioAuthorization";
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
 *   PUT  multipart deck upload | { action: "publish_deck" | status change }
 */
export async function GET(req) {
  try {
    await initDb();

    const authError = await requireAuthorization("investor", "view");
    if (authError) return authError;
    await ensureInvestorExpansionSchema();

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

    const session = await getSession();

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await req.formData();
      const dealFlowEntryId = formData.get("deal_flow_entry_id");
      const file = formData.get("file");
      const uploaded = await uploadInvestorDeckFile({ file, dealFlowEntryId });
      if (!uploaded.success) {
        const status = uploaded.error === "investorAdmin.dealFlow.storageUnavailable" ? 503 : 400;
        return NextResponse.json({ success: false, error: uploaded.error }, { status });
      }
      const result = await addDeck({
        dealFlowEntryId,
        fileRef: uploaded.storagePath,
        fileName: uploaded.fileName,
        mimeType: "application/pdf",
        session,
      });
      if (!result.ok) {
        await removeInvestorDeckFile(uploaded.storagePath);
        return NextResponse.json({ success: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, deck: result.deck });
    }

    const body = await req.json();
    if (body.action === "add_deck") {
      return NextResponse.json({ success: false, error: "investorAdmin.dealFlow.uploadRequired" }, { status: 400 });
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
