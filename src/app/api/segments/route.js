import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

// ── SEGMENTS RETIRED ───────────────────────────────────────────────────────
// Segments are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
const RETIRED = true;
const RETIRED_RESPONSE = NextResponse.json(
  { success: false, error: "Segments are retired and no longer accessible." },
  { status: 403 },
);

export const GET = createHandler(
  { roles: ["staff", "super_admin"] },
  async () => {
    if (RETIRED) return RETIRED_RESPONSE;
    const result = await db.execute(
      "SELECT * FROM segments ORDER BY created_at DESC",
    );
    return NextResponse.json({
      success: true,
      segments: result.rows.map((r) => ({
        ...r,
        filters: JSON.parse(r.criteria || '{}'),
      })),
    });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    if (RETIRED) return RETIRED_RESPONSE;
    const { name, filters } = await req.json();
    if (!name || !filters)
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 },
      );
    const result = await db.execute({
      sql: "INSERT INTO segments (name, criteria) VALUES (?, ?) RETURNING id",
            args: [name, JSON.stringify(filters)],
    });
    return NextResponse.json({ success: true, segment_id: result.rows[0].id });
  },
);
