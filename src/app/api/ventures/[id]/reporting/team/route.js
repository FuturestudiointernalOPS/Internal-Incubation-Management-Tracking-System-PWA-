import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import { getTeam, saveTeam } from "@/services/ventures/reporting/team";

/** GET/POST /api/ventures/[id]/reporting/team?period=YYYY-MM */

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

  const { searchParams } = new URL(req.url);
  const result = await getTeam({ ventureUuid: venture.id, period: searchParams.get("period") });
  if (result.error) return NextResponse.json({ success: false, errors: [result.error] }, { status: 400 });
  return NextResponse.json({ success: true, team: result.team });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await saveTeam({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: body,
  });
  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, team: result.team });
});
