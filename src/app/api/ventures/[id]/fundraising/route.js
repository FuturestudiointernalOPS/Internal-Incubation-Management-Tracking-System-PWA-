import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  listOpportunities, getOpportunity, createOpportunity, updateOpportunity, deleteOpportunity,
  addOpportunityNote, addOpportunityActivity, getPipelineAnalytics,
  PIPELINE_STAGES, ACTIVITY_TYPES,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = params;
  const s = new URL(req.url).searchParams;
  const type = s.get("type") || "pipeline";

  if (type === "pipeline") {
    const opportunities = await listOpportunities(id, s.get("stage"));
    return NextResponse.json({ success: true, opportunities });
  }

  if (type === "detail" && s.get("opportunity_id")) {
    const opp = await getOpportunity(parseInt(s.get("opportunity_id")));
    if (!opp) return NextResponse.json({ success: false, error: "Opportunity not found." }, { status: 404 });
    return NextResponse.json({ success: true, opportunity: opp });
  }

  if (type === "analytics") {
    const analytics = await getPipelineAnalytics(id);
    return NextResponse.json({ success: true, ...analytics });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = params;
  const body = await req.json();

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
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (body.action === "update") {
    await updateOpportunity(parseInt(body.opportunity_id), { ...body.updates, _changed_by: req.session?.cid });
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    await deleteOpportunity(parseInt(body.opportunity_id));
    return NextResponse.json({ success: true });
  }

  if (body.action === "add_note") {
    const result = await addOpportunityNote({ opportunityId: parseInt(body.opportunity_id), content: body.content, authorCid: req.session?.cid, authorName: req.session?.name });
    return NextResponse.json({ success: true, note_id: result.id });
  }

  if (body.action === "add_activity") {
    if (!ACTIVITY_TYPES.includes(body.activity_type)) return NextResponse.json({ success: false, error: `Invalid activity type.` }, { status: 400 });
    const result = await addOpportunityActivity({
      opportunityId: parseInt(body.opportunity_id), activityType: body.activity_type,
      title: body.title, description: body.description, activityDate: body.activity_date,
      createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, activity_id: result.id });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
