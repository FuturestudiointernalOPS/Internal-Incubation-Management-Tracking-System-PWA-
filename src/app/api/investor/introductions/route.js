import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { resolveInvestorContext } from "@/services/investor/activity";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import {
  requestIntroduction,
  listMyIntroductions,
  withdrawMyIntroduction,
} from "@/services/investor/introductions";

const PRIVATE_RESPONSE = { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } };
const publicRequest = (request) => request ? {
  id: request.id,
  venture_id: request.venture_id,
  venture_name: request.venture_name || request.venture_id,
  message: request.message ?? null,
  status: request.status,
  requested_at: request.requested_at,
  decline_reason: request.decline_reason ?? null,
  workspace_id: request.workspace_id ?? null,
} : null;

/** GET /api/investor/introductions — the caller's own introduction requests. */
export async function GET() {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();
    if (!(await readInvestorFlags()).introductions) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { ...PRIVATE_RESPONSE, status: 404 });
    }

    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const ctx = await resolveInvestorContext(await getSession());
    if (!ctx.investorId || ctx.approvalStatus !== "approved") {
      return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { ...PRIVATE_RESPONSE, status: 403 });
    }
    const result = await listMyIntroductions({ investorId: ctx.investorId });
    return NextResponse.json({ success: true, requests: result.requests.map(publicRequest) }, PRIVATE_RESPONSE);
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { ...PRIVATE_RESPONSE, status: 500 });
  }
}

/** POST /api/investor/introductions { venture_id, deal_flow_entry_id?, message? } */
export async function POST(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();
    if (!(await readInvestorFlags()).introductions) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { ...PRIVATE_RESPONSE, status: 404 });
    }

    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const session = await getSession();
    const ctx = await resolveInvestorContext(session);
    if (!ctx.investorId) {
      return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { ...PRIVATE_RESPONSE, status: 403 });
    }
    if (ctx.approvalStatus !== "approved") {
      return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { ...PRIVATE_RESPONSE, status: 403 });
    }

    const body = await req.json();
    const { venture_id, deal_flow_entry_id, message } = body || {};
    if (typeof venture_id !== "string" || !venture_id.trim() || venture_id.length > 100
      || (deal_flow_entry_id != null && (!Number.isSafeInteger(Number(deal_flow_entry_id)) || Number(deal_flow_entry_id) < 1))
      || (message != null && (typeof message !== "string" || message.length > 1000))) {
      return NextResponse.json({ success: false, error: "errors.invalidRequest" }, { ...PRIVATE_RESPONSE, status: 400 });
    }

    const result = await requestIntroduction({
      investorId: ctx.investorId,
      ventureId: venture_id.trim(),
      dealFlowEntryId: deal_flow_entry_id == null ? null : Number(deal_flow_entry_id),
      message: message ?? null,
      session,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { ...PRIVATE_RESPONSE, status: result.status });
    }
    return NextResponse.json({ success: true, request: publicRequest(result.request) }, PRIVATE_RESPONSE);
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { ...PRIVATE_RESPONSE, status: 500 });
  }
}

/** PATCH /api/investor/introductions { id, action: "withdraw" } */
export async function PATCH(req) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();
    if (!(await readInvestorFlags()).introductions) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { ...PRIVATE_RESPONSE, status: 404 });
    }
    const denied = await requireInvestorSelfServiceAuthorization("edit");
    if (denied) return denied;
    const session = await getSession();
    const ctx = await resolveInvestorContext(session);
    if (!ctx.investorId || ctx.approvalStatus !== "approved") {
      return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { ...PRIVATE_RESPONSE, status: 403 });
    }
    const body = await req.json();
    if (!body || body.action !== "withdraw" || !/^[1-9]\d*$/.test(String(body.id || ""))
      || BigInt(body.id) > 9223372036854775807n) {
      return NextResponse.json({ success: false, error: "errors.invalidRequest" }, { ...PRIVATE_RESPONSE, status: 400 });
    }
    const result = await withdrawMyIntroduction({ id: String(body.id), investorId: ctx.investorId, session });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { ...PRIVATE_RESPONSE, status: result.status });
    }
    return NextResponse.json({ success: true, request: publicRequest(result.request) }, PRIVATE_RESPONSE);
  } catch (_error) {
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, { ...PRIVATE_RESPONSE, status: 500 });
  }
}
