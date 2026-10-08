import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import { buildRegistryFeed } from "@/services/contacts/registryFeed";

/**
 * CONTACTS FULL-STATE API — CENTRAL REGISTRY FEED
 * Aggregates contacts, groups, and families for the Personnel Dashboard.
 */

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    // Scope: the PM parameter comes from the request, and the branch WITHOUT it
    // reads the whole registry. A non-management holder of contacts.view may
    // only read their OWN scope; the global feed is for staff / Super Admin.
    const session = await getSession();
    let pmId = searchParams.get("pm_id");
    if (!["super_admin", "staff", "program_manager"].includes(session?.role)) {
      if (pmId && String(pmId) !== String(session?.cid)) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      pmId = session?.cid || null;
    }

    const { contacts, families, teams } = await buildRegistryFeed({ pmId, statusFilter });

    return NextResponse.json({
      success: true,
      contacts,
      families,
      teams,
    });
  } catch (error) {
    console.error("Registry State Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
