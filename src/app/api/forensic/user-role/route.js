import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * FORENSIC: Check user role resolution
 * GET /api/forensic/user-role?email=soriane@example.com
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "email param required" },
        { status: 400 },
      );
    }

    const contact = await db.execute({
      sql: "SELECT cid, name, email, role, group_name, status FROM contacts WHERE email = ? LIMIT 1",
      args: [email.toLowerCase().trim()],
    });

    return NextResponse.json({
      found: contact.rows.length > 0,
      contact: contact.rows[0] || null,
      wouldResolveTo:
        contact.rows.length > 0 ? resolveRole(contact.rows[0]) : null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function resolveRole(user) {
  if (user.role === "super_admin" || user.id === "sa") return "super_admin";
  if (
    user.role === "staff" ||
    user.role === "project_manager" ||
    user.role === "admin"
  )
    return "staff";
  if ((user.group_name || "").toUpperCase().includes("FUTURE STUDIO"))
    return "staff";
  if ((user.group_name || "").toUpperCase().includes("STAFF")) return "staff";
  return "participant";
}
