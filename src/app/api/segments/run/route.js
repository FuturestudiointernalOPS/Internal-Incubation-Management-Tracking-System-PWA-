import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { retiredRouteResponse } from "@/server/http/refusal";
import {
  querySegmentContacts,
} from "@/models/groups/segments";

// ── SEGMENTS RETIRED ───────────────────────────────────────────────────────
// Segments are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
const RETIRED = true;

export const POST = createHandler(async (req) => {
  if (RETIRED) return retiredRouteResponse("segments/run");
  const { filters } = await req.json();

  const result = await querySegmentContacts(filters);
  return NextResponse.json({ success: true, contacts: result.rows });
});
