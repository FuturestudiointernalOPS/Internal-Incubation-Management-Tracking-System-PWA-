import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getActiveSessions,
  revokeSession,
  revokeUserSessions,
  logAuditEvent,
} from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin", "security_officer"] },
  async (req) => {
    const s = new URL(req.url).searchParams;
    const userCid = s.get("user_cid") || undefined;
    const limit = parseInt(s.get("limit")) || 50;
    const offset = parseInt(s.get("offset")) || 0;

    const sessions = await getActiveSessions({ userCid, limit, offset });
    return NextResponse.json({ success: true, sessions });
  },
);

export const POST = createHandler(
  { roles: ["super_admin", "security_officer"] },
  async (req) => {
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
