import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { resolveVentureCode } from "@/services/ventures/operatingPlans";
import { BUILT_IN_DOCUMENT_TYPE_CODES } from "@/lib/ventureDocumentTypeDefaults";
import {
  canManageVentureDocumentTypes,
  createVentureDocumentType,
  ensureVentureDocumentTypesForVenture,
} from "@/services/ventures/ventureDocumentTypes";
import {
  listVentureDocumentTypes,
} from "@/models/ventureDocumentTypesStore";

/**
 * /api/ventures/[id]/document-types — the documents THIS Venture's Data bank
 * asks for.
 *
 * GET  — anyone who may already see the Venture (a Super Admin, a member of it,
 *        or delegated staff with an assignment). `can_manage` tells the screen
 *        whether to offer the editing controls, and retired types are only
 *        returned to someone who could turn them back on.
 * POST — a Super Admin, or a delegated staff member carrying the `lead_manager`
 *        responsibility ON THIS Venture: define a new document type.
 *
 * The list belongs to the Venture, so a write here never touches another one.
 */

const withFlags = (documentType) => ({
  ...documentType,
  is_builtin: BUILT_IN_DOCUMENT_TYPE_CODES.includes(documentType.code),
});

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;

  // The same gate the Data bank itself uses, so a screen can never be told more
  // than the reader is allowed to see.
  const { session } = await requireVentureAccess(id);
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  const ventureId = await resolveVentureCode(id);
  await ensureVentureDocumentTypesForVenture(ventureId);

  const canManage = await canManageVentureDocumentTypes(session, ventureId);
  const { searchParams } = new URL(req.url);
  const includeInactive = canManage && searchParams.get("include_inactive") === "true";

  const documentTypes = await listVentureDocumentTypes({ ventureId, includeInactive });

  return NextResponse.json({
    success: true,
    venture_id: ventureId,
    can_manage: canManage,
    document_types: documentTypes.map(withFlags),
  });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const ventureId = await resolveVentureCode(id);

  if (!(await canManageVentureDocumentTypes(req.session, ventureId))) {
    return NextResponse.json({ success: false, error: "errors.forbidden" }, { status: 403 });
  }

  await ensureVentureDocumentTypesForVenture(ventureId);

  const body = await req.json().catch(() => ({}));
  try {
    const created = await createVentureDocumentType({
      ventureId,
      label_en: body.label_en,
      label_fr: body.label_fr,
      description: body.description,
      required: body.required !== false,
      verification_method: body.verification_method,
      sort_order: body.sort_order,
      // A type an admin invents is Data-bank storage unless they say otherwise;
      // the built-in seeds are the ones that count for readiness.
      is_readiness: body.is_readiness === true,
      created_by: req.session?.cid || null,
    });
    return NextResponse.json({ success: true, ...created });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});
