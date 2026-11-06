import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireAuthorization } from "@/models/authorization/index";
import { secretMatches } from "@/services/authorization/scheduledSweeps";
import { sendDueMeetingReminders } from "@/services/investor/scheduling";
import { sendDueWorkspaceMessageReminders } from "@/services/investor/workspaceMessages";
import { readInvestorFlags } from "@/services/investor/featureFlags";

/**
 * POST /api/investor/meetings/reminders
 *
 * Sends the 24h, 6h and 1h reminders for due confirmed meetings. Two callers:
 *   - the platform cron (`x-cron-secret` / `Authorization: Bearer`, or `?key=`),
 *     the same scheduled-sweep pattern the reminder sweep uses;
 *   - a studio member holding `investor.edit`, for a manual run.
 *
 * Vercel Cron calls with GET; it runs the same sweep as POST.
 */
export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") || null;
    const presented = req.headers.get("x-cron-secret") || bearer || searchParams.get("key");
    const configured = process.env.CRON_SECRET || process.env.REMINDERS_SECRET_KEY;

    await initDb();
    await ensureInvestorExpansionSchema();
    const messagingEnabled = (await readInvestorFlags()).messaging;

    // Cron path — only when a secret is actually configured AND presented.
    if (configured && presented && secretMatches(presented, configured)) {
      const meetings = await sendDueMeetingReminders({ session: null });
      const messages = messagingEnabled
        ? await sendDueWorkspaceMessageReminders({ session: null })
        : { ok: true, sent: 0, failed: 0 };
      const result = {
        ok: meetings.ok && messages.ok,
        sent: meetings.sent + messages.sent,
        failed: meetings.failed + messages.failed,
      };
      return NextResponse.json(
        { success: result.ok, sent: result.sent, failed: result.failed },
        { status: result.ok ? 200 : 502 },
      );
    }

    // Studio path.
    const authError = await requireAuthorization("investor", "edit");
    if (authError) return authError;

    const session = await getSession();
    const meetings = await sendDueMeetingReminders({ session });
    const messages = messagingEnabled
      ? await sendDueWorkspaceMessageReminders({ session })
      : { ok: true, sent: 0, failed: 0 };
    const result = {
      ok: meetings.ok && messages.ok,
      sent: meetings.sent + messages.sent,
      failed: meetings.failed + messages.failed,
    };
    return NextResponse.json(
      { success: result.ok, sent: result.sent, failed: result.failed },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** Vercel Cron calls with GET; it runs the same sweep as POST. */
export const GET = POST;
