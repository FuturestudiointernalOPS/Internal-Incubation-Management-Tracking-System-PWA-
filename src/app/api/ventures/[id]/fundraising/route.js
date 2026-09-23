import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";
import { ventureOwned, ventureNotFound, resolveVentureDbId } from "@/lib/ventureOwnership";
import {
  listOpportunities, getOpportunity, createOpportunity, updateOpportunity, deleteOpportunity,
  addOpportunityNote, addOpportunityActivity, getPipelineAnalytics,
  ACTIVITY_TYPES,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  if (!(await isStaffActorForVenture(db, id, session))) {
    return NextResponse.json({ success: false, error: "This operation requires staff access to the Venture." }, { status: 403 });
  }
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type") || "pipeline";

  if (type === "pipeline") {
    const opportunities = await listOpportunities(id, searchParams.get("stage"));
    return NextResponse.json({ success: true, opportunities });
  }

  if (type === "detail" && searchParams.get("opportunity_id")) {
    // Object-level authorization: the opportunity must belong to THIS venture.
    const dbId = await resolveVentureDbId(id);
    const opportunity = await getOpportunity(parseInt(searchParams.get("opportunity_id")));
    if (!ventureOwned(opportunity, id, dbId)) return ventureNotFound();
    return NextResponse.json({ success: true, opportunity });
  }

  if (type === "analytics") {
    const analytics = await getPipelineAnalytics(id);
    return NextResponse.json({ success: true, ...analytics });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  if (!(await isStaffActorForVenture(db, id, session))) {
    return NextResponse.json({ success: false, error: "This operation requires staff access to the Venture." }, { status: 403 });
  }
  const body = await req.json();

  // Object-level authorization: every opportunity id below comes from the
  // request, so it must be proven to belong to THIS venture.
  const dbId = await resolveVentureDbId(id);
  const opportunityInVenture = async () => {
    const opportunity = await getOpportunity(parseInt(body.opportunity_id));
    return ventureOwned(opportunity, id, dbId) ? opportunity : null;
  };

  if (body.action === "create") {
    try {
      const result = await createOpportunity({
        ventureId: id, investorId: body.investor_id, investorName: body.investor_name,
        investorEmail: body.investor_email, expectedAmount: body.expected_amount,
        currency: body.currency, probability: body.probability,
        expectedCloseDate: body.expected_close_date, ownerCid: body.owner_cid,
        ownerName: body.owner_name, tags: body.tags, nextAction: body.next_action,
        nextActionDate: body.next_action_date, createdBy: req.session?.cid,
      });
      return NextResponse.json({ success: true, opportunity_id: result.id });
    } catch (error) { return NextResponse.json({ success: false, error: error.message }, { status: 400 }); }
  }

  if (body.action === "update") {
    if (!(await opportunityInVenture())) return ventureNotFound();
    await updateOpportunity(parseInt(body.opportunity_id), { ...body.updates, _changed_by: req.session?.cid });
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    if (!(await opportunityInVenture())) return ventureNotFound();
    await deleteOpportunity(parseInt(body.opportunity_id));
    return NextResponse.json({ success: true });
  }

  if (body.action === "add_note") {
    if (!(await opportunityInVenture())) return ventureNotFound();
    const result = await addOpportunityNote({ opportunityId: parseInt(body.opportunity_id), content: body.content, authorCid: req.session?.cid, authorName: req.session?.name });
    return NextResponse.json({ success: true, note_id: result.id });
  }

  if (body.action === "add_activity") {
    if (!ACTIVITY_TYPES.includes(body.activity_type)) return NextResponse.json({ success: false, error: `Invalid activity type.` }, { status: 400 });
    if (!(await opportunityInVenture())) return ventureNotFound();
    const result = await addOpportunityActivity({
      opportunityId: parseInt(body.opportunity_id), activityType: body.activity_type,
      title: body.title, description: body.description, activityDate: body.activity_date,
      createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, activity_id: result.id });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
