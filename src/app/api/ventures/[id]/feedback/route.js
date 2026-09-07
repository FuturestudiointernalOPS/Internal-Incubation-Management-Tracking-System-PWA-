import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  submitFeedback, getFeedback, listFeedback, deleteFeedback,
  getMentorAnalytics, getSessionAnalytics, getFeedbackAnalytics,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const s = new URL(req.url).searchParams;
  const type = s.get("type") || "list";

  if (type === "list") {
    const feedback = await listFeedback({ ventureId: id, coachId: s.get("coach_id"), sessionId: s.get("session_id") });
    return NextResponse.json({ success: true, feedback });
  }

  if (type === "analytics_coaches") {
    const data = await getMentorAnalytics("coach");
    return NextResponse.json({ success: true, analytics: data });
  }

  if (type === "analytics_advisors") {
    const data = await getMentorAnalytics("advisor");
    return NextResponse.json({ success: true, analytics: data });
  }

  if (type === "analytics_sessions") {
    const data = await getSessionAnalytics(id);
    return NextResponse.json({ success: true, ...data });
  }

  if (type === "analytics_feedback") {
    const data = await getFeedbackAnalytics(id);
    return NextResponse.json({ success: true, ...data });
  }

  if (type === "detail" && s.get("feedback_id")) {
    const f = await getFeedback(parseInt(s.get("feedback_id")));
    if (!f) return NextResponse.json({ success: false, error: "Feedback not found." }, { status: 404 });
    return NextResponse.json({ success: true, feedback: f });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const body = await req.json();

  if (body.action === "submit") {
    try {
      const result = await submitFeedback({
        sessionId: parseInt(body.session_id), ventureId: id, coachId: body.coach_id ? parseInt(body.coach_id) : null,
        founderCid: req.session?.cid, ratingOverall: parseInt(body.rating_overall),
        ratingCommunication: body.rating_communication ? parseInt(body.rating_communication) : null,
        ratingExpertise: body.rating_expertise ? parseInt(body.rating_expertise) : null,
        ratingAvailability: body.rating_availability ? parseInt(body.rating_availability) : null,
        ratingHelpfulness: body.rating_helpfulness ? parseInt(body.rating_helpfulness) : null,
        comments: body.comments, isAnonymous: body.is_anonymous,
      });
      return NextResponse.json({ success: true, feedback_id: result.id });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (body.action === "delete") {
    await deleteFeedback(parseInt(body.feedback_id));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
