import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity, updateCurrentProfileCurrency } from "@/models/ventureReportingStore";
import {
  getCurrentProfile,
  getProfileHistory,
  saveProfile,
} from "@/services/ventures/reporting/staticProfile";

/**
 * GET/POST /api/ventures/[id]/reporting/profile
 *
 * The FOUNDER fills the static profile (venture_own scope, `ventures.edit`).
 * The studio may read it (`ventures.view`) and validate it elsewhere later.
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

  const [profile, history] = await Promise.all([
    getCurrentProfile({ ventureUuid: venture.id }),
    getProfileHistory({ ventureUuid: venture.id }),
  ]);

  return NextResponse.json({
    success: true,
    profile,
    history,
    // The Venture's own name: the static profile defaults its LEGAL NAME to
    // this so a founder never retypes what the platform already knows.
    venture_name: venture.venture_name || null,
  });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await saveProfile({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    actorCid: req.session?.cid || null,
    input: body,
  });

  if (result.errors) {
    return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ success: true, profile: result.profile });
});

export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const venture = await resolveVenture(id);
  if (!venture) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const currency = String(body.reportingCurrency || body.currency || "XOF").toUpperCase().trim();

  await updateCurrentProfileCurrency({
    ventureUuid: venture.id,
    ventureCode: venture.venture_id,
    currency,
  });

  return NextResponse.json({ success: true, reportingCurrency: currency });
});
