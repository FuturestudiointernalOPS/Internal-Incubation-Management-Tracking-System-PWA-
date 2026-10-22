import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { queryLoginHistory, getLoginStats } from "@/services/ventures/auditSecurity";

/**
 * Login history is an ADMINISTRATION read (product decision, 2026-10-20): only
 * the platform owner, or an identity explicitly granted `users.view`. The
 * former staff / program-manager admission is removed, and with it the D-1
 * profile check that guarded it.
 */
export const GET = createHandler(
  async (req) => {
    const capError = await requireAuthorization("users", "view");
    if (capError) return capError;

    const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type") || "list";

    if (type === "stats") {
      const hours = parseInt(searchParams.get("hours")) || 24;
      const stats = await getLoginStats(hours);
      return NextResponse.json({ success: true, ...stats });
    }

    const filters = {
      userCid: searchParams.get("user_cid") || undefined,
      action: searchParams.get("action") || undefined,
      isSuccess: searchParams.has("is_success") ? searchParams.get("is_success") === "true" : undefined,
      limit: parseInt(searchParams.get("limit")) || 50,
      offset: parseInt(searchParams.get("offset")) || 0,
      fromDate: searchParams.get("from") || undefined,
      toDate: searchParams.get("to") || undefined,
    };

    const history = await queryLoginHistory(filters);
    return NextResponse.json({ success: true, history });
  },
);
