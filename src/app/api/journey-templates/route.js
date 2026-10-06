import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { initDb } from "@/lib/db";
import { listJourneyTemplates } from "@/services/ventures/journey";

const READ_ROLES = ["staff", "program_manager", "super_admin"];

/**
 * GET /api/journey-templates — the Journey template library
 * (structure-only blueprints of full Venture Journeys).
 */
export const GET = createHandler(
  { roles: READ_ROLES },
  async () => {
    await initDb();
    const templates = await listJourneyTemplates();
    return NextResponse.json({ success: true, templates });
  },
);
