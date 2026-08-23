import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  listCoaches, getCoach, createCoach, updateCoach, deleteCoach,
  getVentureAssignments, assignCoachToVenture, removeAssignment,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/coaches[?type=coach|advisor]
 * POST /api/ventures/[id]/coaches — create + assign
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const s = new URL(req.url).searchParams;
  const type = s.get("type");
  const coaches = await listCoaches(type);
  return NextResponse.json({ success: true, coaches });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const body = await req.json();
  const { action } = body;

  if (action === "assign_coach" || action === "assign_advisor") {
    const coachType = action === "assign_advisor" ? "advisor" : "coach";
    try {
      const result = await assignCoachToVenture({
        ventureId: id,
        coachId: parseInt(body.coach_id),
        coachType,
        isPrimary: body.is_primary,
        assignedBy: req.session?.cid,
        notes: body.notes,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  }

  if (action === "remove_assignment") {
    await removeAssignment(parseInt(body.assignment_id), req.session?.cid);
    return NextResponse.json({ success: true });
  }

  // Create a new coach
  try {
    const result = await createCoach({
      coachType: body.coach_type || "coach",
      fullName: body.full_name,
      email: body.email,
      phone: body.phone,
      organization: body.organization,
      biography: body.biography,
      yearsExperience: body.years_experience,
      areasOfExpertise: body.areas_of_expertise,
      industries: body.industries,
      languages: body.languages,
      timezone: body.timezone,
      linkedinUrl: body.linkedin_url,
      websiteUrl: body.website_url,
      createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, coach_id: result.id });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
});

/**
 * PATCH /api/ventures/[id]/coaches?coach_id=X — update coach
 * DELETE /api/ventures/[id]/coaches?coach_id=X — delete coach
 */
export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const coachId = new URL(req.url).searchParams.get("coach_id");
  if (!coachId) return NextResponse.json({ success: false, error: "coach_id required." }, { status: 400 });
  const body = await req.json();
  await updateCoach(parseInt(coachId), body);
  const coach = await getCoach(parseInt(coachId));
  return NextResponse.json({ success: true, coach });
});

export const DELETE = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const coachId = new URL(req.url).searchParams.get("coach_id");
  if (!coachId) return NextResponse.json({ success: false, error: "coach_id required." }, { status: 400 });
  await deleteCoach(parseInt(coachId));
  return NextResponse.json({ success: true });
});
