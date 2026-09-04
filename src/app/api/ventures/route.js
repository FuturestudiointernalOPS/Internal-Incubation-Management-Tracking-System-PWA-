import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { updateVenture } from "@/lib/ventures";

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

    let sql = `
      SELECT v.*,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.venture_id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.venture_id AND vm.member_type != 'founder' AND vm.removed_at IS NULL) as member_count
      FROM ventures v WHERE 1=1
    `;
    const args = [];

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

    if (effectiveContactId) {
      sql += " AND v.venture_id IN (SELECT vm.venture_id FROM venture_members vm WHERE vm.user_cid = ? OR vm.contact_id = ?)";
      args.push(effectiveContactId, effectiveContactId);
    }

    if (status) {
      sql += " AND v.status = ?";
      args.push(status);
    }

    if (search) {
      sql += " AND (LOWER(v.name) LIKE ? OR LOWER(v.venture_id) LIKE ? OR LOWER(v.industry) LIKE ?)";
      const searchPattern = `%${search.toLowerCase()}%`;
      args.push(searchPattern, searchPattern, searchPattern);
    }

    sql += " ORDER BY v.created_at DESC";

    const result = await db.execute({ sql, args });

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
    const result = await db.execute({
      sql: `INSERT INTO ventures (venture_id, name, description, industry, business_stage, website, mission, vision, sector, program_id, origin_team_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) RETURNING id`,
      args: [venture_id, name, description || null, industry || null, business_stage || "idea", website || null, mission || null, vision || null, sector || null, program_id || null, origin_team_id || null],
    });
    const id = result.rows[0]?.id;
    // Add creator as founder
    try {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (id && session?.cid) {
        await db.execute({
          sql: `INSERT INTO venture_members (venture_id, contact_id, user_cid, role) VALUES (?, ?, ?, 'founder') ON CONFLICT DO NOTHING`,
          args: [venture_id, session.cid, session.cid],
        });
      }
    } catch(e) {
      console.warn("Failed to add venture member:", e.message);
    }

    // Timeline event
    try {
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (session?.cid) {
        await db.execute({
          sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'venture_created', ?, 'ventures', ?, ?, ?::jsonb)`,
          args: [session.cid, `Founded "${name}"`, venture_id, session.cid, JSON.stringify({ venture_name: name, industry })],
        });
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
          await db.execute({
            sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                  VALUES (?, 'venture_updated', ?, 'ventures', ?, ?, ?::jsonb)`,
            args: [session.cid, `Updated venture ${id}`, id, session.cid, JSON.stringify({ updated_fields: updatedFields })],
          });
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, ...result });
});
