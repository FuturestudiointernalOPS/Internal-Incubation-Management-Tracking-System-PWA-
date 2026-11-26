import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import { listInterviews, createInterview, interviewSummary } from "@/services/ventures/reporting/events";

/**
 * GET/POST /api/ventures/[id]/reporting/interviews
 *
 * Customer-discovery interviews, recorded where the interview already lives
 * (`venture_customer_interviews`), now carrying the document or link the studio
 * asked for. The summary applies the studio's own threshold.
 */
async function resolveVenture(id) {
  const result = await selectVentureIdentity(id).catch(() => ({ rows: [] }));
  return (result.rows || [])[0] || null;
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const [{ interviews }, summary] = await Promise.all([
    listInterviews({ ventureUuid: venture.id }),
    interviewSummary({ ventureUuid: venture.id }),
  ]);

  return NextResponse.json({ success: true, interviews, summary });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await createInterview({
    ventureUuid: venture.id,
    actorCid: req.session?.cid || null,
    input: body,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }

  const summary = await interviewSummary({ ventureUuid: venture.id });
  return NextResponse.json({ success: true, interview: result.interview, summary });
});
