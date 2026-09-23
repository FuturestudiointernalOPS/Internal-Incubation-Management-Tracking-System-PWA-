import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { requireAuthorization } from "@/lib/authorization";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
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
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type");

  // No type (or "assigned") = the Venture's ACTIVE assignments (page default
  // tab). Fixes the wiring bug where the global coach catalog was shown as the
  // Venture's assigned coaches and removals targeted the wrong rows.
  if (!type || type === "assigned") {
    const assignments = await getVentureAssignments(id);
    return NextResponse.json({ success: true, coaches: assignments });
  }

  const coaches = await listCoaches(type);
  return NextResponse.json({ success: true, coaches });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
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
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
  }

  if (action === "remove_assignment") {
    // The assignment id comes from the request: only an assignment OF THIS
    // venture may be removed.
    const dbId = await resolveVentureDbId(id);
    await removeAssignment(parseInt(body.assignment_id), access.session?.cid, [id, dbId]);
    return NextResponse.json({ success: true });
  }

  // Create a new coach — a write to the GLOBAL coach directory, which has no
  // venture dimension. AUTHZ-GLOBAL-1: require the platform Ventures capability
  // on top of venture access, so an editor of one venture cannot alter the
  // shared directory for everyone.
  const capError = await requireAuthorization("ventures", "edit");
  if (capError) return capError;
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
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

/**
 * PATCH /api/ventures/[id]/coaches?coach_id=X — update coach
 * DELETE /api/ventures/[id]/coaches?coach_id=X — delete coach
 */
export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  // AUTHZ-GLOBAL-1 — the coach row is GLOBAL, so the catalogue capability is
  // required in addition to venture access.
  const capError = await requireAuthorization("ventures", "edit");
  if (capError) return capError;
  const coachId = new URL(req.url).searchParams.get("coach_id");
  if (!coachId) return NextResponse.json({ success: false, error: "coach_id required." }, { status: 400 });
  const body = await req.json();
  await updateCoach(parseInt(coachId), body);
  const coach = await getCoach(parseInt(coachId));
  return NextResponse.json({ success: true, coach });
});

export const DELETE = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  // AUTHZ-GLOBAL-1 — deleting a global coach row needs the catalogue capability.
  const capError = await requireAuthorization("ventures", "edit");
  if (capError) return capError;
  const coachId = new URL(req.url).searchParams.get("coach_id");
  if (!coachId) return NextResponse.json({ success: false, error: "coach_id required." }, { status: 400 });
  await deleteCoach(parseInt(coachId));
  return NextResponse.json({ success: true });
});
