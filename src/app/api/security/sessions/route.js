import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getActiveSessions, revokeSession, revokeUserSessions } from "@/services/ventures/auditSecurity";

export const GET = createHandler(
  async (req) => {
    const capError = await requireAuthorization("users", "view");
    if (capError) return capError;

    const searchParams = new URL(req.url).searchParams;
    const userCid = searchParams.get("user_cid") || undefined;
    const limit = parseInt(searchParams.get("limit")) || 50;
    const offset = parseInt(searchParams.get("offset")) || 0;

    const sessions = await getActiveSessions({ userCid, limit, offset });
    return NextResponse.json({ success: true, sessions });
  },
);

export const POST = createHandler(
  async (req) => {
    const capError = await requireAuthorization("users", "edit");
    if (capError) return capError;

    const body = await req.json();
    const { action, session_token, user_cid } = body;

    if (action === "revoke") {
      const result = await revokeSession(session_token, req.session?.cid);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === "revoke_all") {
      const result = await revokeUserSessions(
        user_cid,
        req.session?.token || "",
        req.session?.cid,
      );
      return NextResponse.json({ success: true, revoked: result.count });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action." },
      { status: 400 },
    );
  },
);
