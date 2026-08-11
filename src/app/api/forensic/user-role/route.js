import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email)
    return NextResponse.json(
      { error: "email param required" },
      { status: 400 },
    );

  const contact = await db.execute({
    sql: "SELECT cid, name, email, role, group_name, status FROM contacts WHERE email = ? LIMIT 1",
    args: [email.toLowerCase().trim()],
  });

  const resolveRole = (user) => {
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
  };

  return NextResponse.json({
    found: contact.rows.length > 0,
    contact: contact.rows[0] || null,
    wouldResolveTo:
      contact.rows.length > 0 ? resolveRole(contact.rows[0]) : null,
  });
});
