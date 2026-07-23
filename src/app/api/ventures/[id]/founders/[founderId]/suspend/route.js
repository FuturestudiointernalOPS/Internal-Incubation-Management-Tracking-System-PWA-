import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  suspendFounder,
  canManageFounders,
} from "@/lib/ventures";

/**
 * POST /api/ventures/[id]/founders/[founderId]/suspend
 *
 * Suspend a founder.
 */
export const POST = createHandler(
  async (req, { params }) => {
    const { id, founderId } = params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const permission = await canManageFounders(id, session);
    if (!permission.allowed) {
      return NextResponse.json({ success: false, error: "Unauthorized to manage founders." }, { status: 403 });
    }

    try {
      const result = await suspendFounder({
        founderId: parseInt(founderId),
        ventureId: id,
        suspendedByFounderId: permission.founderId,
      });

      return NextResponse.json({ success: true, ...result });
    } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  },
);
