import { NextResponse } from "next/server";

import { initDb } from "@/lib/db";
import { ensureMessagesIsDeletedColumn, ensureMessagesIsReadColumn } from "@/models/communications/messages";
import { getSession } from "@/server/auth/session";
import { requireAuth } from "@/server/auth/guards";
import { logger } from "@/lib/logger";
import { readInvestorFlags } from "@/services/investor/featureFlags";
import { countUnreadWorkspaceMessagesForCaller } from "@/services/investor/workspaceMessages";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    if (!(await readInvestorFlags()).messaging) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, {
        status: 404,
        headers: PRIVATE_HEADERS,
      });
    }

    await ensureMessagesIsDeletedColumn();
    await ensureMessagesIsReadColumn();
    const result = await countUnreadWorkspaceMessagesForCaller({ session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, {
        status: result.status,
        headers: PRIVATE_HEADERS,
      });
    }
    return NextResponse.json({ success: true, unread_count: result.unreadCount }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    logger.error("investor_workspace_unread_count_failed", { error: error.message });
    return NextResponse.json({ success: false, error: "errors.somethingWrong" }, {
      status: 500,
      headers: PRIVATE_HEADERS,
    });
  }
}
