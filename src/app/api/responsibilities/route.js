import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  getUserResponsibilities,
  getAllResponsibilities,
  logPermissionAudit,
} from "@/lib/auth";

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
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");

    if (userCid) {
      const responsibilities = await getUserResponsibilities(userCid);
      return NextResponse.json({
        success: true,
        user_cid: userCid,
        responsibilities,
      });
    }

    const all = await getAllResponsibilities();
    return NextResponse.json({
      success: true,
      responsibilities: all,
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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();
    const { name, key, description, icon } = body;

    if (!name || !key) {
      return NextResponse.json(
        { success: false, error: "name and key are required" },
        { status: 400 },
      );
    }

    await initDb();

    await db.execute({
      sql: `INSERT INTO responsibilities (name, key, description, icon, is_active)
            VALUES (?, ?, ?, ?, 1)`,
      args: [name.trim(), key.trim().toLowerCase(), description || "", icon || ""],
    });

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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

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
      await db.execute({
        sql: "UPDATE responsibilities SET name = ?, updated_at = NOW() WHERE id = ?",
        args: [name.trim(), id],
      });
    }
    if (key !== undefined) {
      await db.execute({
        sql: "UPDATE responsibilities SET key = ?, updated_at = NOW() WHERE id = ?",
        args: [key.trim().toLowerCase(), id],
      });
    }
    if (description !== undefined) {
      await db.execute({
        sql: "UPDATE responsibilities SET description = ?, updated_at = NOW() WHERE id = ?",
        args: [description, id],
      });
    }
    if (icon !== undefined) {
      await db.execute({
        sql: "UPDATE responsibilities SET icon = ?, updated_at = NOW() WHERE id = ?",
        args: [icon, id],
      });
    }
    if (is_active !== undefined) {
      await db.execute({
        sql: "UPDATE responsibilities SET is_active = ?, updated_at = NOW() WHERE id = ?",
        args: [is_active ? 1 : 0, id],
      });
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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

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
    const assigned = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM user_responsibilities WHERE responsibility_id = ?",
      args: [id],
    });

    await db.execute({
      sql: "DELETE FROM responsibilities WHERE id = ?",
      args: [id],
    });

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
