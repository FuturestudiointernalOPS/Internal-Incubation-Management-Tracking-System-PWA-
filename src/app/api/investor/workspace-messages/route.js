import { NextResponse } from "next/server";

import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { requireAuth } from "@/server/auth/guards";
import {
  ensureMessagesIsDeletedColumn,
  ensureMessagesIsReadColumn,
} from "@/models/communications/messages";
import { logger } from "@/lib/logger";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import {
  readWorkspaceConversation,
  sendWorkspaceMessage,
} from "@/services/investor/workspaceMessages";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const errorResponse = (error, status) =>
  NextResponse.json({ success: false, error }, { status, headers: PRIVATE_HEADERS });

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    if (!(await readInvestorFlags()).messaging) return errorResponse("errors.notFound", 404);
    await ensureMessagesIsDeletedColumn();
    await ensureMessagesIsReadColumn();

    const workspaceId = new URL(req.url).searchParams.get("workspace_id");
    const result = await readWorkspaceConversation({
      workspaceId,
      session: await getSession(),
    });
    if (!result.ok) return errorResponse(result.error, result.status);
    return NextResponse.json({ success: true, messages: result.messages }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logger.error("investor_workspace_messages_read_failed", { error: error.message });
    return errorResponse("errors.somethingWrong", 500);
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    if (!(await readInvestorFlags()).messaging) return errorResponse("errors.notFound", 404);
    await ensureMessagesIsDeletedColumn();
    await ensureMessagesIsReadColumn();

    const { workspace_id: workspaceId, body } = await req.json();
    const result = await sendWorkspaceMessage({
      workspaceId,
      body,
      session: await getSession(),
    });
    if (!result.ok) return errorResponse(result.error, result.status);
    return NextResponse.json({ success: true, message: result.message }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logger.error("investor_workspace_message_send_failed", { error: error.message });
    return errorResponse("errors.somethingWrong", 500);
  }
}
