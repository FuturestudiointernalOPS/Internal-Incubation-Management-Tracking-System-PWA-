import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  createPmfAssessment,
  getPmfAssessments,
  getPmfVentureId,
} from "@/models/ventureJourney";


async function resolveVentureDbId(ventureId) {
  const ventureResult = await getPmfVentureId(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const { session } = access;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const assessmentsResult = await getPmfAssessments(dbId);
    return NextResponse.json({ success: true, assessments: assessmentsResult.rows || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { customer_feedback, improvements, pmf_progress } = await req.json();
    await createPmfAssessment(dbId, customer_feedback || null, improvements || null, pmf_progress || 0, session.cid);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
