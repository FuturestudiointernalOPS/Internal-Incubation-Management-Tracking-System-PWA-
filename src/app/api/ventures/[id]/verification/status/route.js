import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  updateVerificationStatus,
  canManageVerification,
  getOrCreateVerification,
} from "@/lib/ventures";

/**
 * PATCH /api/ventures/[id]/verification/status
 *
 * Update verification status (approve, reject, suspend).
 * Only reviewers (super_admin, verification_officer, staff) can update.
 */
export const PATCH = createHandler(
  async (req, { params }) => {
    const { id } = params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const permission = await canManageVerification(id, session);
    if (!permission.allowed || !permission.isReviewer) {
      return NextResponse.json({ success: false, error: "Unauthorized. Only reviewers can update verification status." }, { status: 403 });
    }

    const body = await req.json();
    const { status: newStatus, category, notes } = body;

    if (!newStatus || !["verified", "rejected", "suspended"].includes(newStatus)) {
      return NextResponse.json({ success: false, error: "Status must be verified, rejected, or suspended." }, { status: 400 });
    }

    const data = await getOrCreateVerification(id);

    try {
      const result = await updateVerificationStatus({
        verificationId: data.verification.id,
        ventureId: id,
        newStatus,
        category,
        reviewerCid: session.cid || "system",
        reviewerName: session.name || "System",
        notes,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  },
);
