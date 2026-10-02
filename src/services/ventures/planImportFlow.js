/**
 * services/ventures/planImportFlow — the decisions of the programme import
 * controller: which sheet of a workbook carries the work, how a tracker becomes
 * a stored proposal, and how a reviewed draft is applied.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/plan-import/route.js` (lane
 * L2). The controller keeps the access gates (`ventures.view` / `ventures.edit`),
 * the multipart reading, the size limit, every response and its status code.
 * Refusals come back as data (`{ ok: false, ... }` / `{ error, status }`) with
 * the exact former messages and extra fields.
 *
 * The interpreting itself lives in `services/ventures/planImport.js`; this
 * module only sequences it. Same facades as the controller used. No SQL, no HTTP.
 */
import { selectPlanSheet, normalizeSheetName } from "@/lib/venturePlanSheet";
import {
  interpretPlanSheet,
  buildExistingProgramme,
  applyPlanImport,
  getPlanImport,
  createPlanImport,
  updatePlanImportProposal,
} from "@/services/ventures/planImport";

/**
 * ── WHICH SHEET CARRIES THE WORK ────────────────────────────────────────────
 * A workbook is not one table. Reading the wrong tab does not fail — it
 * produces a confident, wrong programme. So the choice is made by name: the
 * caller's answer wins, else a sheet called "Tracker", else the only sheet
 * there is. Several sheets and none named is a QUESTION for the person who
 * made the file, never a guess.
 *
 * @returns {{ ok: true, name: string }
 *          | { ok: false, error: string, needsSheetChoice: true, sheets: string[] }}
 */
export function choosePlanSheet(sheets, requestedSheet) {
  const choice = selectPlanSheet(sheets);
  const picked = requestedSheet
    ? sheets.find((item) => normalizeSheetName(item.name) === normalizeSheetName(requestedSheet)) || null
    : null;

  if (requestedSheet && !picked) {
    return {
      ok: false,
      error: `This workbook has no sheet named "${requestedSheet}".`,
      needsSheetChoice: true,
      sheets: choice.names,
    };
  }

  if (!picked && choice.status === "ambiguous") {
    // Nothing is stored: no draft, no proposal, no call to the model. The
    // answer to "which sheet?" is the only thing that can decide the plan.
    return {
      ok: false,
      error: "This workbook has several sheets and none of them is named \"Tracker\". Choose the sheet that holds the activities.",
      needsSheetChoice: true,
      sheets: choice.names,
    };
  }

  return { ok: true, name: picked ? picked.name : choice.name };
}

/**
 * Interprets the chosen sheet and stores the proposal as this Venture's open
 * DRAFT. A reassessment must know what the Venture already has, or the analyst
 * will happily propose the same programme a second time.
 *
 * @returns {Promise<{ ok: false, error: string }
 *   | { ok: true, saved: object, interpretation: object, existing: object, sheetSummary: Array }>}
 */
export async function proposePlanFromSheet({ dbId, sheet, contextText, planSheetName, fileName, actorCid }) {
  const existing = await buildExistingProgramme({ dbId });
  const interpretation = await interpretPlanSheet({
    sheets: sheet.sheets,
    contextText,
    existingProgrammeText: existing.text,
    sheetName: planSheetName,
  });
  if (!interpretation.ok) {
    return {
      ok: false,
      error: interpretation.error,
      error_key: interpretation.error_key || null,
      error_params: interpretation.error_params || null,
    };
  }

  const sheetSummary = sheet.sheets.map((item) => ({
    name: item.name,
    rows: item.rows.length,
    plan: item.name === planSheetName,
  }));
  const saved = await createPlanImport({
    ventureId: dbId,
    fileName: fileName || null,
    fileKind: sheet.kind,
    sheets: sheetSummary,
    proposal: interpretation.proposal,
    warnings: interpretation.warnings,
    actorCid: actorCid || null,
  });

  return { ok: true, saved, interpretation, existing, sheetSummary };
}

/**
 * ── APPLY: save what is on screen, then build the programme ──────────────
 *
 * @returns {Promise<{ error: string, status: number } | { result: object }>}
 */
export async function applyPlanDraft({ dbId, draftId, proposal, actorCid }) {
  let draft = await getPlanImport({ id: draftId, ventureId: dbId });
  if (!draft) return { error: "errors.notFound", status: 404 };
  if (draft.status !== "proposed") {
    return { error: "This proposal is no longer open for review.", status: 409 };
  }

  // The reviewer's last edits are saved FIRST, so what gets built is what
  // they were looking at — never a stale row behind their back.
  if (proposal && Array.isArray(proposal.journeys)) {
    const saved = await updatePlanImportProposal({ id: draftId, ventureId: dbId, proposal });
    if (saved.error) return { error: saved.error, status: 409 };
    draft = saved.draft;
  }

  const result = await applyPlanImport({
    dbId,
    importId: draftId,
    proposal: draft.proposal,
    actorCid: actorCid || null,
  });
  if (result.error) return { error: result.error, status: 409 };

  return { result };
}
