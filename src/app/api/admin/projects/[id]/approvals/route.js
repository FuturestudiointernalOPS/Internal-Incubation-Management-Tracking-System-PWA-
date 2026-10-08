import { initDb } from "@/lib/db";
import { requireProjectAccess } from "@/server/authz/guards";
import { NextResponse } from "next/server";
import {
  listApprovals,
  reviewApproval,
} from "@/services/dashboard/adminProjectApprovals";

/**
 * PROJECT APPROVALS API
 *
 * GET  /api/admin/projects/[id]/approvals
 *   - Returns all pending and historical approval requests for this project
 *
 * POST /api/admin/projects/[id]/approvals
 *   - Approve or reject a contribution request
 *
 * Body (POST):
 *   request_id: number  — the ID from project_approval_requests
 *   reviewer_id: string — the project owner / reviewer
 *   reviewer_name: string — display name
 *   action: "approved" | "rejected"
 *   rejection_reason: string (required if rejected)
 *
 * The workflow lives in `services/dashboard/adminProjectApprovals`; this
 * controller keeps `initDb`, the project-scope guard and the envelope.
 */

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    const { status, body } = await listApprovals(id);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET project approvals error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    const { request_id, reviewer_id, reviewer_name, action, rejection_reason } =
      await req.json();

    const { status, body } = await reviewApproval({
      projectId: id,
      requestId: request_id,
      reviewerId: reviewer_id,
      reviewerName: reviewer_name,
      action,
      rejectionReason: rejection_reason,
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST project approvals error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
