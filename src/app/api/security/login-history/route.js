import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  queryLoginHistory,
  getLoginStats,
} from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin", "security_officer", "program_manager"] },
  async (req) => {
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
