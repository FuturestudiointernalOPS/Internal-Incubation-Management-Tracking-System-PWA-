import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { updateVenture } from "@/lib/ventures";
import {
  addCreatorAsVentureFounder,
  insertVenture,
  listVenturesWithCounts,
  recordVentureCreatedTimeline,
  recordVentureUpdatedTimeline,
} from "@/models/ventureWorkspace";

/**
 * GET /api/ventures
 * List all ventures with summary counts.
 */
export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager", "participant", "founder", "teacher", "developer"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const contactId = searchParams.get("contact_id");

    // Phase 5 hardening: non-privileged roles (participant/founder/teacher)
    // can only list their OWN ventures — never the whole directory.
    let effectiveContactId = contactId;
    try {
      const session = await getSession();
      if (session && !["super_admin", "staff", "program_manager", "developer"].includes(session.role)) {
        effectiveContactId = session.cid;
      }
    } catch (_) {}

    const result = await listVenturesWithCounts({ effectiveContactId, status, search });

    return NextResponse.json({
      success: true,
      ventures: result.rows,
    });
  },
);

/**
 * POST /api/ventures
 * Create a new venture.
 */
export const POST = createHandler(async (req) => {
  // RETIRED (Phase 1): Venture creation only flows through the Forms/Runs
  // intake pipeline (Form → Run → Submission → Review → Approval → Venture).
  // Even Super Admin cannot create Ventures directly anymore.
  return NextResponse.json(
    {
      success: false,
      code: "LEGACY_FLOW_RETIRED",
      error:
        "Direct Venture creation is retired. Ventures are created only through the Venture Application form approval pipeline.",
    },
    { status: 410 },
  );
  // Dead code below kept only to preserve route structure.
  const capError = await requireAuthorization("ventures", "create");
  if (capError) return capError;
  // Phase 2 pipeline rule: Ventures are created via the Venture Application
  // Form/Run approval process. Direct API creation is super admin only
  // (internal fallback for the approval rule).
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Venture creation is only available through the Venture Application process." },
      { status: 403 },
    );
  }
  const { name, description, industry, business_stage, website, mission, vision, sector, program_id, origin_team_id } = await req.json();
    if (!name) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }
    const venture_id = `VNT-${uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase()}`;
    const result = await insertVenture({ venture_id, name, description, industry, business_stage, website, mission, vision, sector, program_id, origin_team_id });
    const id = result.rows[0]?.id;
    // Add creator as founder
    try {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (id && session?.cid) {
        await addCreatorAsVentureFounder({ venture_id, cid: session.cid });
      }
    } catch(e) {
      console.warn("Failed to add venture member:", e.message);
    }

    // Timeline event
    try {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (session?.cid) {
        await recordVentureCreatedTimeline({ contact_cid: session.cid, name, industry, venture_id });
      }
    } catch (_) {}

    return NextResponse.json({ success: true, id, venture_id });
});

/**
 * PUT /api/ventures
 * Update a venture. Expects { id: venture_id, ...fields } in body.
 */
export const PUT = createHandler(async (req) => {
  const capError = await requireAuthorization("ventures", "edit");
  if (capError) return capError;
  const body = await req.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "id (venture_id) is required" }, { status: 400 });
    }
    // Convert social_media/branding objects to JSON strings for SQLite
    if (updates.social_media) updates.social_media = JSON.stringify(updates.social_media);
    if (updates.branding) updates.branding = JSON.stringify(updates.branding);
    const result = await updateVenture(id, updates);

    // Timeline event
    if (result.updated) {
      try {
        const { getSession } = await import("@/lib/auth");
        const session = await getSession();
        if (session?.cid) {
          const updatedFields = Object.keys(updates).filter(k => k !== "social_media" && k !== "branding");
          await recordVentureUpdatedTimeline({ contact_cid: session.cid, venture_id: id, updated_fields: updatedFields });
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, ...result });
});
