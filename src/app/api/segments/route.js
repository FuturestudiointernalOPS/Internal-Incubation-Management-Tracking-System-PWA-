import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { retiredRouteResponse } from "@/server/http/refusal";
import {
  listSegments,
  createSegment,
} from "@/models/groups/segments";

// ── SEGMENTS RETIRED ───────────────────────────────────────────────────────
// Segments are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
// No role list: a retired path refuses every authenticated identity alike, and
// each hit is logged so the route can be deleted once traffic proves it dead.
const RETIRED = true;

export const GET = createHandler(async () => {
  if (RETIRED) return retiredRouteResponse("segments");
  const result = await listSegments();
  return NextResponse.json({
    success: true,
    segments: result.rows.map((row) => ({
      ...row,
      filters: JSON.parse(row.criteria || '{}'),
    })),
  });
});

export const POST = createHandler(async (req) => {
  if (RETIRED) return retiredRouteResponse("segments");
  const { name, filters } = await req.json();
  if (!name || !filters)
    return NextResponse.json(
      { success: false, error: "Missing fields" },
      { status: 400 },
    );
  const result = await createSegment(name, JSON.stringify(filters));
  return NextResponse.json({ success: true, segment_id: result.rows[0].id });
});
