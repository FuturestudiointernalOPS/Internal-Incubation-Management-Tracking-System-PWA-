import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  findContactCidByCid,
  setContactInactive,
  deleteUserSessions,
} from "@/models/authFlows";

export const dynamic = "force-dynamic";

export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req, { params }) => {
    const { cid } = await params;
    const contactRes = await findContactCidByCid(cid);
    if (contactRes.rows.length === 0)
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
