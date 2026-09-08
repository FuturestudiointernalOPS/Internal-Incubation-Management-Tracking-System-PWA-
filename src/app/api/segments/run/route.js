import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { querySegmentContacts } from "@/models/groups";

// ── SEGMENTS RETIRED ───────────────────────────────────────────────────────
// Segments are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
const RETIRED = true;
const RETIRED_RESPONSE = NextResponse.json(
  { success: false, error: "Segments are retired and no longer accessible." },
  { status: 403 },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    if (RETIRED) return RETIRED_RESPONSE;
    const { filters } = await req.json();

    const result = await querySegmentContacts(filters);
    return NextResponse.json({ success: true, contacts: result.rows });
  },
);
