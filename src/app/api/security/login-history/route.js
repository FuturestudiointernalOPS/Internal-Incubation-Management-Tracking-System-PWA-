import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  queryLoginHistory,
  getLoginStats,
} from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin", "security_officer", "program_manager"] },
  async (req) => {
    const s = new URL(req.url).searchParams;
    const type = s.get("type") || "list";

    if (type === "stats") {
      const hours = parseInt(s.get("hours")) || 24;
      const stats = await getLoginStats(hours);
      return NextResponse.json({ success: true, ...stats });
    }

    const filters = {
      userCid: s.get("user_cid") || undefined,
      action: s.get("action") || undefined,
      isSuccess: s.has("is_success") ? s.get("is_success") === "true" : undefined,
      limit: parseInt(s.get("limit")) || 50,
      offset: parseInt(s.get("offset")) || 0,
      fromDate: s.get("from") || undefined,
      toDate: s.get("to") || undefined,
    };

    const history = await queryLoginHistory(filters);
    return NextResponse.json({ success: true, history });
  },
);
