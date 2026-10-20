import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { initDb } from "@/lib/db";
import { listJourneyTemplates } from "@/services/ventures/journey";

/**
 * GET /api/journey-templates — the Journey template library
 * (structure-only blueprints of full Venture Journeys).
 */
export const GET = createHandler(
  async () => {
    const capError = await requireAuthorization("programs", "view");
    if (capError) return capError;

    await initDb();
    const templates = await listJourneyTemplates();
    return NextResponse.json({ success: true, templates });
  },
);
