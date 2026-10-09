import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { buildLeadManagerHome } from "@/services/ventures/leadManagerDashboard";

export const dynamic = "force-dynamic";

/**
 * GET /api/ventures/lead-manager/home
 *
 * Operational "My day" for a staff Lead Manager: KPIs, urgency queue and
 * enriched Mes Ventures cards, limited to Ventures where the caller has an
 * active `lead_manager` assignment. Super Admin is steered to /admin (empty).
 */
export const GET = createHandler(
  { roles: ["staff", "program_manager", "super_admin"] },
  async () => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    if (session.role === "super_admin") {
      return NextResponse.json({
        success: true,
        is_lead_manager: false,
        kpis: null,
        queue: [],
        ventures: [],
        note: "super_admin_uses_admin_console",
      });
    }

    const home = await buildLeadManagerHome(session.cid);
    return NextResponse.json({ success: true, ...home });
  },
);
