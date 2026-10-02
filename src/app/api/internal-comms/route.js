import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/models/authorization/index";
import {
  mayReadInbox,
  readMessageInbox,
  sendInternalMessage,
  markMessagesRead,
} from "@/services/communications/internalComms";

/**
 * /api/internal-comms — the internal message inbox.
 *
 * GET    /api/internal-comms?cid=   read an inbox (own, or any as Super Admin)
 * POST   /api/internal-comms        send a message (direct / role / program / all)
 * PUT    /api/internal-comms        mark messages read
 *
 * The scope engine and the three use-cases live in
 * `@/services/communications/internalComms`; this route authenticates, gates on
 * the capability and shapes the HTTP answer.
 */

export async function GET(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const capError = await requireAuthorization("messaging", "view");
    if (capError) return capError;
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");

    // SECURITY: Users can only request their own messages unless super_admin
    if (!mayReadInbox(session, cid)) {
      return NextResponse.json(
        { success: false, error: "You can only access your own messages." },
        { status: 403 },
      );
    }

    const messages = await readMessageInbox({ session, cid });
    return NextResponse.json({ success: true, messages });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const capError = await requireAuthorization("messaging", "send");
    if (capError) return capError;
    const payload = await req.json();

    const outcome = await sendInternalMessage({ session, payload });
    if (outcome.denied) {
      return NextResponse.json(
        { success: false, error: outcome.denied.error },
        { status: outcome.denied.status },
      );
    }

    return NextResponse.json({ success: true, id: outcome.id });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const capError = await requireAuthorization("messaging", "view");
    if (capError) return capError;
    const { messageIds, conversationWith } = await req.json();

    const outcome = await markMessagesRead({ session, messageIds, conversationWith });
    if (outcome.denied) {
      return NextResponse.json(
        { success: false, error: outcome.denied.error },
        { status: outcome.denied.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT internal-comms error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
