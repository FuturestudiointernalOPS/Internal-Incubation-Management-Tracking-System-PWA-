import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  getUserResponsibilities,
  getAllResponsibilities,
  logPermissionAudit,
  seedDefaultResponsibilities,
} from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { normalizeAllowedRoles } from "@/lib/featureAccess";
import {
  countResponsibilityAssignments,
  createResponsibility,
  deleteResponsibility,
  updateResponsibilityActive,
  updateResponsibilityDescription,
  updateResponsibilityIcon,
  updateResponsibilityKey,
  updateResponsibilityName,
} from "@/models/responsibilities";

/**
 * GET /api/responsibilities
 *
 * Query params:
 *   ?user_cid=X — get responsibilities for a specific user
 *   (none) — list all available responsibilities
 */
export async function GET(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    await initDb();
    // Self-heal: ensure the responsibility definitions always exist so the
    // Responsibilities tab never renders an empty list.
    await seedDefaultResponsibilities();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");

    if (userCid) {
      const responsibilities = await getUserResponsibilities(userCid);
      return NextResponse.json({
        success: true,
        user_cid: userCid,
        responsibilities: responsibilities.map((r) => ({
          ...r,
          allowed_roles: normalizeAllowedRoles(r.allowed_roles),
        })),
      });
    }

    const all = await getAllResponsibilities();
    return NextResponse.json({
      success: true,
      responsibilities: all.map((r) => ({
        ...r,
        allowed_roles: normalizeAllowedRoles(r.allowed_roles),
      })),
    });
  } catch (err) {
    console.error("[Responsibilities] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/responsibilities
 *
 * Create a new responsibility definition.
 * Body: { name, key, description, icon }
 */
export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const body = await req.json();
    const { name, key, description, icon } = body;

    if (!name || !key) {
      return NextResponse.json(
        { success: false, error: "name and key are required" },
        { status: 400 },
      );
    }

    await initDb();

    await createResponsibility(name, key, description, icon);

    return NextResponse.json({
      success: true,
      message: `Responsibility "${name}" created`,
    });
  } catch (err) {
    console.error("[Responsibilities] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/responsibilities
 *
 * Update a responsibility definition.
 * Body: { id, name?, key?, description?, icon?, is_active? }
 */
export async function PUT(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const body = await req.json();
    const { id, name, key, description, icon, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    await initDb();

    if (name !== undefined) {
      await updateResponsibilityName(id, name);
    }
    if (key !== undefined) {
      await updateResponsibilityKey(id, key);
    }
    if (description !== undefined) {
      await updateResponsibilityDescription(id, description);
    }
    if (icon !== undefined) {
      await updateResponsibilityIcon(id, icon);
    }
    if (is_active !== undefined) {
      await updateResponsibilityActive(id, is_active);
    }

    return NextResponse.json({
      success: true,
      message: "Responsibility updated",
    });
  } catch (err) {
    console.error("[Responsibilities] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/responsibilities?id=X
 *
 * Delete a responsibility definition.
 */
export async function DELETE(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Check if any users have this responsibility assigned
    const assigned = await countResponsibilityAssignments(id);

    await deleteResponsibility(id);

    return NextResponse.json({
      success: true,
      message: "Responsibility deleted",
      unassigned: assigned.rows[0]?.cnt || 0,
    });
  } catch (err) {
    console.error("[Responsibilities] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
