import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  transferOwnership,
  canManageFounders,
} from "@/lib/ventures";

/**
 * POST /api/ventures/[id]/founders/transfer-ownership
 *
 * Transfer venture ownership to another founder.
 */
export const POST = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const permission = await canManageFounders(id, session);
    if (!permission.allowed || !permission.isOwner) {
      return NextResponse.json({ success: false, error: "Only the current owner can transfer ownership." }, { status: 403 });
    }

    const body = await req.json();
    const { new_owner_id } = body;

    if (!new_owner_id) {
      return NextResponse.json({ success: false, error: "new_owner_id is required." }, { status: 400 });
    }

    try {
      const result = await transferOwnership({
        ventureId: id,
        currentOwnerId: permission.founderId,
        newOwnerId: parseInt(new_owner_id),
        transferredByFounderId: permission.founderId,
      });

      return NextResponse.json({ success: true, ...result });
    } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  },
);
