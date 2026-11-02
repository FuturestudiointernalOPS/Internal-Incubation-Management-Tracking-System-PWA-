import { NextResponse } from "next/server";
import { resolvePublicDataRoom } from "@/services/ventures/dataRoom";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/data-room/[token]
 *
 * Public unauthenticated endpoint for external investors to view shared documents.
 */
export async function GET(req, { params }) {
  const { token } = await params;
  const result = await resolvePublicDataRoom({ token });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 404 },
    );
  }

  const { ok: _ok, ...data } = result;
  return NextResponse.json({ success: true, ...data });
}
