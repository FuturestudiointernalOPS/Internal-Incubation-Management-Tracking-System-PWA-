import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { listJourneyTemplates } from "@/lib/ventureJourneyTemplates";

const READ_ROLES = ["staff", "program_manager", "super_admin", "developer", "admin"];

/**
 * GET /api/journey-templates — the Journey template library
 * (structure-only blueprints of full Venture Journeys).
 */
export const GET = createHandler(
  { roles: READ_ROLES },
  async () => {
    await initDb();
    const templates = await listJourneyTemplates(db);
    return NextResponse.json({ success: true, templates });
  },
);
