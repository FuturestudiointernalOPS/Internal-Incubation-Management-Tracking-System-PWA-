import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction, resolveVentureCode } from "@/lib/ventureOperatingPlans";
import { isStaffActorForVenture, roleIsPrivileged } from "@/lib/ventureAuth";
import { createVentureReport, listVentureReports, getVentureReport, updateVentureReportStatus } from "@/lib/ventureReports";

export const dynamic = "force-dynamic";

/**
 * Venture Progress Reports (Vinance 3 — Phase 3, doc §14).
 *
 * GET  /api/ventures/[id]/progress-reports[?status=submitted&id=N]
 *      — read reports (staff with an active Venture assignment or global role)
 * POST { title, reporting_period, summary, … } — Manager composes a report
 * PATCH { id, status: draft|submitted|reviewed|archived } — submit/review
 *
 * Writes require `operating_plan` manage (Manager authority); reads are
 * staff-scoped (any active assignment). Reports become part of the Venture's
 * institutional memory.
 */
async function viewer() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const session = await viewer();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const code = await resolveVentureCode(db, id);
    if (!code) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const staff = roleIsPrivileged(session.role) || (session.cid ? await isStaffActorForVenture(db, id, session) : false);
    if (!staff) {
      return NextResponse.json({ success: false, error: "Staff access required." }, { status: 403 });
    }

    const s = new URL(req.url).searchParams;
    const reportId = s.get("id");
    if (reportId) {
      const report = await getVentureReport(db, { code, id: parseInt(reportId) });
      if (!report) return NextResponse.json({ success: false, error: "Report not found." }, { status: 404 });
      return NextResponse.json({ success: true, report });
    }
    const reports = await listVentureReports(db, { code, status: s.get("status") || null });
    return NextResponse.json({ success: true, reports });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await viewer();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(db, id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "manage"))) {
      return NextResponse.json({ success: false, error: "Only the Venture Manager (or a global role) can create progress reports." }, { status: 403 });
    }

    const code = await resolveVentureCode(db, id);
    if (!code) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const result = await createVentureReport(db, { code, actorCid: session.cid || null, fields: body });
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: code, event_type: "VENTURE_REPORT_CREATED", description: `Progress report "${String(body.title || "").slice(0, 80)}" created` });
    } catch (_) {}

    return NextResponse.json({ success: true, id: result.id });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const session = await viewer();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(db, id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "manage"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow updating progress reports." }, { status: 403 });
    }

    const code = await resolveVentureCode(db, id);
    if (!code) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    if (!body.id || !body.status) {
      return NextResponse.json({ success: false, error: "id and status are required." }, { status: 400 });
    }
    const result = await updateVentureReportStatus(db, { code, id: parseInt(body.id), status: String(body.status) });
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: code, event_type: `VENTURE_REPORT_${String(body.status).toUpperCase()}`, description: `Progress report #${body.id} marked ${body.status}` });
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
