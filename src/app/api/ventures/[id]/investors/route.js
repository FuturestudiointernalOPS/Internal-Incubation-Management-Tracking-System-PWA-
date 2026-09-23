import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import {
  listInvestors, getInvestor, createInvestor,
  getVentureMatches, generateMatches, updateMatchStatus,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  if (!(await isStaffActorForVenture(db, id, session))) {
    return NextResponse.json({ success: false, error: "This operation requires staff access to the Venture." }, { status: 403 });
  }
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type") || "directory";

  if (type === "directory") {
    const investors = await listInvestors({ search: searchParams.get("search"), status: searchParams.get("status") });
    return NextResponse.json({ success: true, investors });
  }

  if (type === "investor" && searchParams.get("investor_id")) {
    const investor = await getInvestor(parseInt(searchParams.get("investor_id")));
    if (!investor) return NextResponse.json({ success: false, error: "Investor not found." }, { status: 404 });
    return NextResponse.json({ success: true, investor });
  }

  if (type === "matches") {
    const matches = await getVentureMatches(id, parseInt(searchParams.get("min_score")) || 0);
    return NextResponse.json({ success: true, matches });
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

  if (body.action === "create_investor") {
    const result = await createInvestor({
      name: body.name, email: body.email, organization: body.organization,
      investmentThesis: body.investment_thesis, industries: body.industries,
      preferredCountries: body.preferred_countries, preferredStage: body.preferred_stage,
      minTicket: body.min_ticket, maxTicket: body.max_ticket, portfolio: body.portfolio,
      websiteUrl: body.website_url, linkedinUrl: body.linkedin_url,
      createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, investor_id: result.id });
  }

  if (body.action === "generate_matches") {
    const result = await generateMatches(id);
    return NextResponse.json({ success: true, ...result });
  }

  if (body.action === "update_match") {
    // Object-level authorization: a match id from the request is scoped to THIS
    // venture, so another venture's match cannot be changed.
    const dbId = await resolveVentureDbId(id);
    await updateMatchStatus(parseInt(body.match_id), body.status, [id, dbId]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
