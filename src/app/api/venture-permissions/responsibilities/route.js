import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { listResponsibilities, getResponsibility } from "@/lib/venturePermissions";

// Permission configuration is Super Admin territory (delegated staff access
// is defined here). Reads also serve the admin console.
const READ_ROLES = ["super_admin", "developer", "admin"];
const WRITE_ROLES = ["super_admin", "developer", "admin"];

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(READ_ROLES);
    if (authError) return authError;
    const includeInactive = new URL(req.url).searchParams.get("include_inactive") === "1";
    const responsibilities = await listResponsibilities(db, { includeInactive });
    return NextResponse.json({ success: true, responsibilities });
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
    const { name, code, description } = await req.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ success: false, error: "Responsibility name is required." }, { status: 400 });
    }
    const finalCode = slugify(code || name);
    if (!finalCode) {
      return NextResponse.json({ success: false, error: "A valid code could not be derived." }, { status: 400 });
    }
    const existing = await getResponsibility(db, finalCode);
    if (existing) {
      return NextResponse.json({ success: false, error: "A responsibility with this code already exists." }, { status: 409 });
    }
    await db.execute({
      sql: "INSERT INTO venture_responsibilities (code, name, description, created_by) VALUES (?,?,?,?)",
      args: [finalCode, String(name).trim(), description || null, session?.cid || null],
    });
    return NextResponse.json({ success: true, responsibility: await getResponsibility(db, finalCode) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth(WRITE_ROLES);
    if (authError) return authError;
    const { code, name, description, is_active } = await req.json();
    const existing = await getResponsibility(db, code);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Responsibility not found." }, { status: 404 });
    }
    await db.execute({
      sql: "UPDATE venture_responsibilities SET name = COALESCE(?, name), description = COALESCE(?, description), is_active = COALESCE(?, is_active), updated_at = NOW() WHERE code = ?",
      args: [name ? String(name).trim() : null, description ?? null, typeof is_active === "boolean" ? (is_active ? 1 : 0) : null, code],
    });
    return NextResponse.json({ success: true, responsibility: await getResponsibility(db, code) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
