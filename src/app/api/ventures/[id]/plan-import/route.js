import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { readPlanSheet, selectPlanSheet, normalizeSheetName, PLAN_SHEET_OK } from "@/lib/venturePlanSheet";
import { MAX_PLAN_UPLOAD_BYTES } from "@/lib/venturePlanSheetRules";
import {
  interpretPlanSheet,
  buildExistingProgramme,
  revisePlanProposal,
  applyPlanImport,
  getOpenPlanImport,
  getPlanImport,
  createPlanImport,
  updatePlanImportProposal,
  discardPlanImport,
} from "@/services/ventures/planImport";

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

    // ── WHICH SHEET CARRIES THE WORK ────────────────────────────────────────
    // A workbook is not one table. Reading the wrong tab does not fail — it
    // produces a confident, wrong programme. So the choice is made HERE, by
    // name: the caller's answer wins, else a sheet called "Tracker", else the
    // only sheet there is. Several sheets and none named is a QUESTION for the
    // person who made the file, never a guess.
    const requestedSheet = String(formData.get("sheet") || "").trim();
    const choice = selectPlanSheet(sheet.sheets);
    const picked = requestedSheet
      ? sheet.sheets.find((item) => normalizeSheetName(item.name) === normalizeSheetName(requestedSheet)) || null
      : null;

    if (requestedSheet && !picked) {
      return NextResponse.json(
        {
          success: false,
          error: `This workbook has no sheet named "${requestedSheet}".`,
          needsSheetChoice: true,
          sheets: choice.names,
        },
        { status: 400 },
      );
    }

    if (!picked && choice.status === "ambiguous") {
      // Nothing is stored: no draft, no proposal, no call to the model. The
      // answer to "which sheet?" is the only thing that can decide the plan.
      return NextResponse.json(
        {
          success: false,
          error: "This workbook has several sheets and none of them is named \"Tracker\". Choose the sheet that holds the activities.",
          needsSheetChoice: true,
          sheets: choice.names,
        },
        { status: 400 },
      );
    }

    const planSheetName = picked ? picked.name : choice.name;

    // A reassessment must know what the Venture already has, or the analyst will
    // happily propose the same programme a second time.
    const existing = await buildExistingProgramme({ dbId });
    const interpretation = await interpretPlanSheet({
      sheets: sheet.sheets,
      contextText,
      existingProgrammeText: existing.text,
      sheetName: planSheetName,
    });
    if (!interpretation.ok) {
      // `error_key` is what a screen translates; `error` stays for logs and API
      // consumers. Both travel, so no user-facing English is decided here.
      return NextResponse.json(
        {
          success: false,
          error: interpretation.error,
          error_key: interpretation.error_key || null,
          error_params: interpretation.error_params || null,
        },
        { status: 422 },
      );
    }

    const sheetSummary = sheet.sheets.map((item) => ({
      name: item.name,
      rows: item.rows.length,
      plan: item.name === planSheetName,
    }));
    const saved = await createPlanImport({
      ventureId: dbId,
      fileName: file.name || null,
      fileKind: sheet.kind,
      sheets: sheetSummary,
      proposal: interpretation.proposal,
      warnings: interpretation.warnings,
      actorCid: access.session?.cid || null,
    });

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
      let draft = await getPlanImport({ id: draftId, ventureId: dbId });
      if (!draft) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      if (draft.status !== "proposed") {
        return NextResponse.json({ success: false, error: "This proposal is no longer open for review." }, { status: 409 });
      }

      // The reviewer's last edits are saved FIRST, so what gets built is what
      // they were looking at — never a stale row behind their back.
      if (body.proposal && Array.isArray(body.proposal.journeys)) {
        const saved = await updatePlanImportProposal({ id: draftId, ventureId: dbId, proposal: body.proposal });
        if (saved.error) return NextResponse.json({ success: false, error: saved.error }, { status: 409 });
        draft = saved.draft;
      }

      const result = await applyPlanImport({
        dbId,
        importId: draftId,
        proposal: draft.proposal,
        actorCid: access.session?.cid || null,
      });
      if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 409 });

      return NextResponse.json({ success: true, applied: result.counts, warnings: result.warnings });
    }

    // ── CORRECT: a plain-language instruction, answered with a suggestion ──
    if (typeof body.instruction === "string" && body.instruction.trim()) {
      const base = body.proposal && Array.isArray(body.proposal.journeys)
        ? body.proposal
        : (await getPlanImport({ id: draftId, ventureId: dbId }))?.proposal;
      if (!base) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

      const revised = await revisePlanProposal({ proposal: base, instruction: body.instruction });
      if (!revised.ok) {
        return NextResponse.json(
          {
            success: false,
            error: revised.error,
            error_key: revised.error_key || null,
            error_params: revised.error_params || null,
          },
          { status: 422 },
        );
      }

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
