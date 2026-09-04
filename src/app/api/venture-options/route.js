/**
 * /api/venture-options — configurable Venture taxonomies (Phase 4)
 *
 * Backs the "Venture Setup" configuration area: business stages, industry/
 * sector options, and future option types. No hardcoded classification lists.
 *
 * GET  — any authenticated user (selects read from this)
 * POST — super_admin + staff (Venture Setup) — create an option
 * PATCH — super_admin + staff (Venture Setup) — update label/sort/active
 *
 * The `ventures.setup` capability replaces the role check in the permissions
 * hardening phase; until then the role gate above applies.
 */

import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";

const SETUP_ROLES = ["super_admin", "staff"];

export async function GET(req) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const optionType = searchParams.get("option_type");
    const includeInactive = searchParams.get("include_inactive") === "true";

    let sql = "SELECT id, option_type, value, label, sort_order, is_active FROM venture_option_values WHERE 1=1";
    const args = [];
    if (optionType) {
      sql += " AND option_type = ?";
      args.push(optionType);
    }
    if (!includeInactive) {
      sql += " AND is_active = TRUE";
    }
    sql += " ORDER BY option_type ASC, sort_order ASC, value ASC";

    const res = await db.execute({ sql, args });
    return NextResponse.json({ success: true, options: res.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session || !SETUP_ROLES.includes(session.role)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Venture Setup permission required." },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const { option_type, value, label, sort_order } = body;
    if (!option_type || !value) {
      return NextResponse.json({ success: false, error: "option_type and value are required." }, { status: 400 });
    }
    const res = await db.execute({
      sql: `INSERT INTO venture_option_values (option_type, value, label, sort_order, is_active, created_at)
            VALUES (?, ?, ?, ?, TRUE, NOW())
            ON CONFLICT (option_type, value) DO UPDATE SET label = EXCLUDED.label
            RETURNING id`,
      args: [option_type, value, label || value, sort_order || 0],
    });
    return NextResponse.json({ success: true, id: res.rows[0]?.id });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session || !SETUP_ROLES.includes(session.role)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Venture Setup permission required." },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const { id, label, sort_order, is_active } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
    }
    const sets = [];
    const args = [];
    if (label !== undefined) { sets.push("label = ?"); args.push(label); }
    if (sort_order !== undefined) { sets.push("sort_order = ?"); args.push(sort_order); }
    if (is_active !== undefined) { sets.push("is_active = ?"); args.push(is_active ? true : false); }
    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update." }, { status: 400 });
    }
    args.push(id);
    await db.execute({
      sql: `UPDATE venture_option_values SET ${sets.join(", ")} WHERE id = ?`,
      args,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
