import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

// Global, reusable catalog (business rule 49) — not venture-scoped, so this is a
// plain role check, not the venture_members membership check used elsewhere.
const READ_ROLES = ["participant", "staff", "program_manager", "super_admin", "teacher", "developer"];
const WRITE_ROLES = ["staff", "program_manager", "super_admin"];

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(READ_ROLES);
    if (authError) return authError;
    const r = await db.execute({ sql: "SELECT * FROM venture_kpi_definitions WHERE is_active = true ORDER BY name", args: [] });
    return NextResponse.json({ success: true, kpi_definitions: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(WRITE_ROLES);
    if (authError) return authError;
    const session = await getSession();
    const { name, description, unit, auto_calc_source, formula, frequency, measurement_method, default_target } = await req.json();
    if (!name) return NextResponse.json({ success: false, error: "name required" }, { status: 400 });
    await db.execute({
      sql: "INSERT INTO venture_kpi_definitions (name, description, unit, auto_calc_source, formula, frequency, measurement_method, default_target, created_by) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [name, description || null, unit || null, auto_calc_source || null, formula || null, frequency || null, measurement_method || null, default_target ?? null, session?.cid || null],
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth(WRITE_ROLES);
    if (authError) return authError;
    const { id, name, description, unit, auto_calc_source, formula, frequency, measurement_method, default_target, is_active } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    const updates = [];
    const args = [];
    if (name !== undefined) { updates.push("name = ?"); args.push(name); }
    if (description !== undefined) { updates.push("description = ?"); args.push(description); }
    if (unit !== undefined) { updates.push("unit = ?"); args.push(unit); }
    if (auto_calc_source !== undefined) { updates.push("auto_calc_source = ?"); args.push(auto_calc_source); }
    if (formula !== undefined) { updates.push("formula = ?"); args.push(formula); }
    if (frequency !== undefined) { updates.push("frequency = ?"); args.push(frequency); }
    if (measurement_method !== undefined) { updates.push("measurement_method = ?"); args.push(measurement_method); }
    if (default_target !== undefined) { updates.push("default_target = ?"); args.push(default_target); }
    if (is_active !== undefined) { updates.push("is_active = ?"); args.push(is_active); }
    if (!updates.length) return NextResponse.json({ success: false, error: "No fields" }, { status: 400 });
    args.push(id);
    await db.execute({ sql: `UPDATE venture_kpi_definitions SET ${updates.join(", ")} WHERE id = ?`, args });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
