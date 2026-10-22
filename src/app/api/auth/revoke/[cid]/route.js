import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  findContactCidByCid,
  setContactInactive,
  deleteUserSessions,
} from "@/models/authFlows";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  async (req, { params }) => {
    const authError = await requireAuthorization("users", "suspend");
    if (authError) return authError;

    const { cid } = await params;
    const contactResult = await findContactCidByCid(cid);
    if (contactResult.rows.length === 0)
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    await setContactInactive(cid);
    await deleteUserSessions(cid);
    return NextResponse.json({
      success: true,
      message: "Access revoked. User sessions destroyed.",
    });
  },
);
