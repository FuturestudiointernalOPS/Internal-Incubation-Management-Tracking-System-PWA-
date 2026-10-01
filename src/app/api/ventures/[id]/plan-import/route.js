import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { readPlanSheet, PLAN_SHEET_OK } from "@/lib/venturePlanSheet";
import { MAX_PLAN_UPLOAD_BYTES } from "@/lib/venturePlanSheetRules";
import {
  revisePlanProposal,
  getOpenPlanImport,
  getPlanImport,
  updatePlanImportProposal,
  discardPlanImport,
} from "@/models/venturePlanImport";
import { choosePlanSheet, proposePlanFromSheet, applyPlanDraft } from "@/services/ventures/planImportFlow";

export const dynamic = "force-dynamic";

/**
 * /api/ventures/[id]/plan-import — the programme import (Phases 1 to 3).
 *
 *   POST   multipart { file, context } — read a tracker, propose a programme,
 *          and store the proposal as this Venture's open DRAFT.
 *   GET    the open draft (or ?id= for one specific draft).
 *   PATCH  { id, instruction, proposal } — CORRECT the draft in plain language
 *            and return what would change. Nothing is written.
 *          { id, proposal } — save the reviewer's corrections.
 *          { id, action: "apply", proposal? } — save, then turn the draft into
 *            journey rows: stages, milestones, tasks, deliverables, edges.
 *          { id, action: "discard" } — close the draft without applying it.
 *
 * Reading and correcting never touch the Venture; applying is the one step that
 * does, and it is the reviewed one — which is the whole point of "the document
 * is an input, never the source of truth".
 *
 * The gate is `ventures.edit` to write and `ventures.view` to read: whoever may
 * change the programme is who may propose a change to it.
 */
export const maxDuration = 300;

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const requestedId = new URL(req.url).searchParams.get("id");
    const draft = requestedId
      ? await getPlanImport({ id: requestedId, ventureId: dbId })
      : await getOpenPlanImport(dbId);

    // An id that belongs to another Venture (or none) is a 404, not an empty draft.
    if (requestedId && !draft) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

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

    // Which sheet carries the work (the caller's answer, else "Tracker", else
    // the only sheet; otherwise a question): services/ventures/planImportFlow.
    const requestedSheet = String(formData.get("sheet") || "").trim();
    const sheetChoice = choosePlanSheet(sheet.sheets, requestedSheet);
    if (!sheetChoice.ok) {
      const { ok: _ok, ...refusal } = sheetChoice;
      return NextResponse.json({ success: false, ...refusal }, { status: 400 });
    }
    const planSheetName = sheetChoice.name;

    // Interpret the sheet and store the open draft: services/ventures/planImportFlow.
    const proposed = await proposePlanFromSheet({
      dbId, sheet, contextText, planSheetName,
      fileName: file.name, actorCid: access.session?.cid,
    });
    if (!proposed.ok) {
      return NextResponse.json({ success: false, error: proposed.error }, { status: 422 });
    }
    const { saved, interpretation, existing, sheetSummary } = proposed;

    return NextResponse.json({
      success: true,
      draft_id: saved.id,
      superseded: saved.superseded,
      kind: sheet.kind,
      plan_sheet: planSheetName,
      sheets: sheetSummary,
      truncated: sheet.truncated || interpretation.truncated,
      proposal: interpretation.proposal,
      stats: saved.stats,
      unmatched_owners: saved.unmatched_owners,
      warnings: interpretation.warnings,
      existing_programme: existing.counts,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const draftId = body?.id ? String(body.id) : null;
    if (!draftId) return NextResponse.json({ success: false, error: "id required." }, { status: 400 });

    if (body.action === "discard") {
      const result = await discardPlanImport({ id: draftId, ventureId: dbId });
      if (!result.discarded) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      return NextResponse.json({ success: true, discarded: true });
    }

    // ── APPLY: save what is on screen, then build the programme ──────────
    if (body.action === "apply") {
      const applied = await applyPlanDraft({
        dbId, draftId, proposal: body.proposal, actorCid: access.session?.cid,
      });
      if (applied.error) return NextResponse.json({ success: false, error: applied.error }, { status: applied.status });
      const { result } = applied;

      return NextResponse.json({ success: true, applied: result.counts, warnings: result.warnings });
    }

    // ── CORRECT: a plain-language instruction, answered with a suggestion ──
    if (typeof body.instruction === "string" && body.instruction.trim()) {
      const base = body.proposal && Array.isArray(body.proposal.journeys)
        ? body.proposal
        : (await getPlanImport({ id: draftId, ventureId: dbId }))?.proposal;
      if (!base) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

      const revised = await revisePlanProposal({ proposal: base, instruction: body.instruction });
      if (!revised.ok) return NextResponse.json({ success: false, error: revised.error }, { status: 422 });

      // NOTHING is stored: the reviewer decides whether to keep the suggestion.
      return NextResponse.json({
        success: true,
        proposal: revised.proposal,
        changes: revised.changes,
        notes: revised.notes,
        unmatched_owners: revised.unmatched_owners,
        warnings: revised.warnings,
      });
    }

    // A draft is only ever the proposal it claims to be: refuse a payload that
    // is not one rather than storing something Apply cannot build.
    if (!body.proposal || typeof body.proposal !== "object" || !Array.isArray(body.proposal.journeys)) {
      return NextResponse.json({ success: false, error: "proposal with a journeys array required." }, { status: 400 });
    }

    const result = await updatePlanImportProposal({ id: draftId, ventureId: dbId, proposal: body.proposal });
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 409 });

    return NextResponse.json({ success: true, draft: result.draft });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
