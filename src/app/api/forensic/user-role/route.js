import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getContactForRoleResolution } from "@/models/platformConfig";

export const GET = createHandler(async (req) => {
    const capError = await requireAuthorization("users", "view");
    if (capError) return capError;
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email)
    return NextResponse.json(
      { error: "email param required" },
      { status: 400 },
    );

  const contact = await getContactForRoleResolution(email);

  const resolveRole = (user) => {
    if (user.role === "super_admin" || user.id === "sa") return "super_admin";
    if (
      user.role === "staff" ||
      user.role === "project_manager"
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
