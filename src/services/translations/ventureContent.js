/**
 * Warming the Venture translation memory (SERVICE layer).
 *
 * Step 1 translated on demand: correct, but the FIRST reader still paid for it.
 * This module moves the work before the visit, through the two moments a system
 * without a queue can actually rely on:
 *
 *   • a WRITE schedules a warm-up (debounced, fire-and-forget) — so the wording
 *     is usually ready by the time anyone opens the Project screen;
 *   • a READ warms in the background too, which is what catches every path that
 *     was not hooked (templates, duplication, plan import) without needing to
 *     remember them;
 *   • a scheduled SWEEP walks the Ventures that have not been warmed for a while,
 *     so a Venture nobody has opened yet is still ready on its first visit.
 *
 * The three share ONE declaration of what counts as prose (see
 * `@/lib/workItemText`), so a field added to the screen can never be translated
 * by the screen and forgotten by the warm-up.
 *
 * Every entry point is safe to call twice: the memory is keyed on the text, so a
 * second pass reaches the provider for nothing.
 */

import { buildWorkItems } from "@/services/workItems";
import { collectTexts, detectContentLanguage } from "@/lib/contentTranslation";
import { WORK_ITEM_TEXT_PATHS } from "@/lib/workItemText";
import {
  ensureContentTranslationsTable,
  markVentureTranslationSwept,
  selectVenturesDueForTranslationSweep,
} from "@/models/contentTranslations";
import { TRANSLATION_LANGUAGES, translateContent } from "./contentTranslation";

/**
 * Warm ONE already-read payload — no second read of the work.
 * The read controller has the items in hand, so this is free apart from the
 * translations themselves.
 */
export async function warmVenturePayloadTranslations({ payload }) {
  const report = { texts: 0, sourceLang: null, pairs: [], translated: 0, fromMemory: 0, failed: 0 };

  const texts = collectTexts(payload, WORK_ITEM_TEXT_PATHS);
  if (!texts.length) return report;

  const sourceLang = detectContentLanguage(texts);
  const pairs = TRANSLATION_LANGUAGES.filter((code) => code !== sourceLang);

  report.texts = texts.length;
  report.sourceLang = sourceLang;
  report.pairs = pairs;

  for (const targetLang of pairs) {
    const result = await translateContent({ texts, sourceLang, targetLang });
    report.translated += result.translated;
    report.fromMemory += result.fromMemory;
    report.failed += result.failed;
  }

  return report;
}

/** Warm ONE Venture, reading its work first (the sweep and the write hook). */
export async function warmVentureTranslations({ ventureRef }) {
  if (!ventureRef) return { texts: 0, sourceLang: null, pairs: [], translated: 0, fromMemory: 0, failed: 0 };

  // The work reads match `venture_id` in both forms (internal id and VNT code),
  // so the same reference can be handed to both arguments.
  const payload = await buildWorkItems({ dbId: ventureRef, ventureCode: ventureRef });
  return warmVenturePayloadTranslations({ payload });
}

/**
 * The scheduled pass: the Ventures whose work has not been warmed recently,
 * oldest first, plus an optional targeted `ventureRef` for a one-off run.
 */
export async function runTranslationSweep({
  ventureRef = null,
  limit = 20,
  maxAgeMinutes = 60,
} = {}) {
  const report = { ventures: 0, texts: 0, translated: 0, fromMemory: 0, failed: 0, errors: 0 };

  // The rotation table is part of the memory's schema; on a fresh database the
  // select below would otherwise run before anything had created it.
  await ensureContentTranslationsTable();

  let refs = [];
  if (ventureRef) {
    refs = [String(ventureRef)];
  } else {
    const due = await selectVenturesDueForTranslationSweep({ limit, maxAgeMinutes });
    refs = (due.rows || []).map((row) => row.venture_ref).filter(Boolean);
  }

  for (const ref of refs) {
    try {
      const result = await warmVentureTranslations({ ventureRef: ref });
      report.ventures += 1;
      report.texts += result.texts || 0;
      report.translated += result.translated || 0;
      report.fromMemory += result.fromMemory || 0;
      report.failed += result.failed || 0;
      await markVentureTranslationSwept(ref).catch(() => {});
    } catch (error) {
      // One Venture must not stop the rotation.
      report.errors += 1;
      console.error(`[content-translation] sweep failed for ${ref}:`, error.message);
    }
  }

  return report;
}

/**
 * Called by the write paths. TRAILING debounce: a manager editing six fields in
 * a row warms once, five seconds after the last save, never six times.
 *
 * Fire-and-forget on purpose — a translation problem must never fail a save.
 *
 * Inert under test: a unit test must never reach a provider (or a database)
 * seconds after it finished. What this guards — warming one Venture — is covered
 * directly by `warmVentureTranslations` and `runTranslationSweep`.
 */
const WARM_DEBOUNCE_MS = 5000;
const SCHEDULER_ENABLED = process.env.NODE_ENV !== "test";
const warmTimers = new Map();

export function scheduleVentureTranslationWarmup(ventureRef) {
  if (!SCHEDULER_ENABLED || !ventureRef) return;
  const ref = String(ventureRef);

  const existing = warmTimers.get(ref);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    warmTimers.delete(ref);
    warmVentureTranslations({ ventureRef: ref }).catch(() => {});
  }, WARM_DEBOUNCE_MS);

  // A pending warm-up is not a reason to keep a shutting-down server alive.
  if (typeof timer.unref === "function") timer.unref();
  warmTimers.set(ref, timer);
}
