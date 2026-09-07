import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  getVentureById,
  updateVenture,
  logVentureActivity,
  addVentureHistory,
  createVentureNotification,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]
 *
 * Fetch a venture by its venture_id with all related data.
 */
export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager", "participant", "founder", "teacher", "developer"] },
  async (req, { params }) => {
    const { id } = await params;

    const { requireVentureAccess } = await import("@/lib/ventureAuth");
    const { session } = await requireVentureAccess(id, db);
    if (!session) {
      return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    }

    const venture = await getVentureById(id);

    if (!venture) {
      return NextResponse.json(
        { success: false, error: "Venture not found" },
        { status: 404 },
      );
    }

    // Archived Ventures are historical: privileged staff may read; non-
    // privileged members lose active access (Phase 3).
    if (session) {
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const gate = await requireOperationalVentureAccess({ ventureId: id, db, session, mutate: false });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json(
          { success: false, code: "VENTURE_ARCHIVED", error: gate.reason, venture_id: id, status: "archived" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      venture,
    });
  },
);

/**
 * PATCH /api/ventures/[id]
 *
 * Update a venture's information.
 * Only super_admin can update.
 */
export const PATCH = createHandler(async (req, { params }) => {
  const capError = await requireAuthorization("ventures", "edit");
  if (capError) return capError;
  const { id } = await params;

    // Check venture exists
    const existingVenture = await getVentureById(id);
    if (!existingVenture) {
      return NextResponse.json(
        { success: false, error: "Venture not found" },
        { status: 404 },
      );
    }

    // Archived Ventures are immutable historical records — no mutations for
    // anyone (including staff) until the Venture is resumed (Phase 3).
    try {
      const { getSession } = await import("@/lib/auth");
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const session = await getSession();
      const gate = await requireOperationalVentureAccess({ ventureId: id, db, session, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json(
          { success: false, code: "VENTURE_ARCHIVED", error: gate.reason },
          { status: 409 },
        );
      }
    } catch (_) {}

    const body = await req.json();

    // Validate if company_name is being updated
    if (body.company_name !== undefined && !body.company_name.trim()) {
      return NextResponse.json(
        { success: false, error: "Company name cannot be empty" },
        { status: 400 },
      );
    }

    // Update the venture
    const result = await updateVenture(id, body);

    // Log activity
    const changedFields = Object.keys(body).filter(
      (k) => body[k] !== undefined && k !== "session",
    );
    if (changedFields.length > 0) {
      await logVentureActivity({
        venture_id: id,
        action: "VENTURE_UPDATED",
        actor_cid: req.session?.cid || "system",
        actor_name: req.session?.name || "System",
        details: {
          updated_fields: changedFields,
        },
      });

      await addVentureHistory({
        venture_id: id,
        event_type: "VENTURE_UPDATED",
        description: `Venture information updated: ${changedFields.join(", ")}`,
        metadata: {
          updated_fields: changedFields,
        },
      });
    }

    // Fetch updated venture
    const updatedVenture = await getVentureById(id);

    return NextResponse.json({
      success: true,
      venture: updatedVenture,
    });
});
