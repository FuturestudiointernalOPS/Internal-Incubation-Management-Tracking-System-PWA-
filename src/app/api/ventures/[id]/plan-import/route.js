import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { readPlanSheet, PLAN_SHEET_OK } from "@/lib/venturePlanSheet";
import { MAX_PLAN_UPLOAD_BYTES } from "@/lib/venturePlanSheetRules";
import { interpretPlanSheet } from "@/models/venturePlanImport";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/plan-import — multipart form-data
 *   file    : the tracker (.xlsx or .csv, max 5MB)
 *   context : optional free text describing the business (the sheet is the
 *             tracker; this is what the reviewer wants the analyst to know)
 *
 * Phase 1 of the programme import: READ the sheet, ASK the model to map it into
 * the platform hierarchy, VALIDATE the answer against our own data, and return
 * the PROPOSAL. Nothing is written — no journey, milestone, task or deliverable
 * is created here. Creating them is the reviewed step that comes next, which is
 * the whole point of the document-is-not-the-source-of-truth rule.
 *
 * The gate is `ventures.edit`: whoever may change the programme is who may
 * propose a change to it. A read-only member can still view the venture; they
 * are refused here with the standard scope decision.
 */
export const maxDuration = 300;

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    let formData;
    try {
      formData = await req.formData();
    } catch (_) {
      return NextResponse.json(
        { success: false, error: "Upload the tracker as form-data with a `file` field." },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_PLAN_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "The file is larger than 5 MB — split the tracker and upload it in parts." },
        { status: 413 },
      );
    }

    const contextText = String(formData.get("context") || "").slice(0, 20000);

    const sheet = readPlanSheet({
      name: file.name,
      mime: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    });

    if (sheet.status !== PLAN_SHEET_OK) {
      return NextResponse.json(
        { success: false, error: sheet.error, status: sheet.status },
        { status: 400 },
      );
    }

    const interpretation = await interpretPlanSheet({ sheets: sheet.sheets, contextText });
    if (!interpretation.ok) {
      return NextResponse.json({ success: false, error: interpretation.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      kind: sheet.kind,
      sheets: sheet.sheets.map((item) => ({ name: item.name, rows: item.rows.length })),
      truncated: sheet.truncated || interpretation.truncated,
      proposal: interpretation.proposal,
      unmatched_owners: interpretation.unmatched_owners,
      warnings: interpretation.warnings,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
