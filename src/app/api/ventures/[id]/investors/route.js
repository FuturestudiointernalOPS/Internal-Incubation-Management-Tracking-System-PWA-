import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  listInvestors, getInvestor, createInvestor,
  getVentureMatches, generateMatches, updateMatchStatus,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const s = new URL(req.url).searchParams;
  const type = s.get("type") || "directory";

  if (type === "directory") {
    const investors = await listInvestors({ search: s.get("search"), status: s.get("status") });
    return NextResponse.json({ success: true, investors });
  }

  if (type === "investor" && s.get("investor_id")) {
    const inv = await getInvestor(parseInt(s.get("investor_id")));
    if (!inv) return NextResponse.json({ success: false, error: "Investor not found." }, { status: 404 });
    return NextResponse.json({ success: true, investor: inv });
  }

  if (type === "matches") {
    const matches = await getVentureMatches(id, parseInt(s.get("min_score")) || 0);
    return NextResponse.json({ success: true, matches });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
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
    await updateMatchStatus(parseInt(body.match_id), body.status);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
