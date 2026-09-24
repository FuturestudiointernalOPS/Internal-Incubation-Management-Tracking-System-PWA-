import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { resolveVentureCode } from "@/lib/ventureOperatingPlans";
import {
  canManageVentureDocumentTypes,
  deleteVentureDocumentType,
  ensureVentureDocumentTypesForVenture,
  updateVentureDocumentType,
} from "@/models/ventureDocumentTypes";

/**
 * /api/ventures/[id]/document-types/[typeId] — change or remove ONE document
 * type of ONE Venture.
 *
 * PATCH  — label, French label, help text, required flag, how it is confirmed,
 *          display order, active.
 * DELETE — only for a type this product did not ship with, and only while no
 *          document has been filed against it for this Venture (otherwise the
 *          uploaded files would vanish from the Data bank without being
 *          deleted). Retiring a built-in type means turning it off.
 *
 * Both are Super Admin / Lead Manager acts, scoped to the Venture in the URL.
 */

async function requireManage(req, params) {
  const { id } = await params;
  const ventureId = await resolveVentureCode(db, id);
  if (!(await canManageVentureDocumentTypes(req.session, ventureId))) {
    return { error: NextResponse.json({ success: false, error: "errors.forbidden" }, { status: 403 }) };
  }
  await ensureVentureDocumentTypesForVenture(ventureId);
  return { ventureId };
}

export const PATCH = createHandler(async (req, { params }) => {
  const gate = await requireManage(req, params);
  if (gate.error) return gate.error;

  const { typeId } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    await updateVentureDocumentType({
      ventureId: gate.ventureId,
      id: typeId,
      fields: {
        label_en: body.label_en,
        label_fr: body.label_fr,
        description: body.description,
        required: body.required,
        verification_method: body.verification_method,
        sort_order: body.sort_order,
        is_active: body.is_active,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

export const DELETE = createHandler(async (req, { params }) => {
  const gate = await requireManage(req, params);
  if (gate.error) return gate.error;

  const { typeId } = await params;
  try {
    await deleteVentureDocumentType({ ventureId: gate.ventureId, id: typeId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});
