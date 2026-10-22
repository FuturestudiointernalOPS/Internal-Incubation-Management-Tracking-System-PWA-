import db, { initDb } from "@/lib/db";

/**
 * Content translation memory (REPOSITORY layer).
 *
 * The texts of a Venture's work — titles, activities, deliverables, definitions
 * of done — belong to a language of their own and are displayed in the reader's,
 * so each pair of texts must be translated ONCE and then remembered. This table
 * is that memory.
 *
 * The key is the SOURCE TEXT ITSELF (through its hash), not the record that
 * carries it. That is deliberate: when a title is corrected, its text changes,
 * so its key changes, so the next read translates the new wording and never
 * serves the old one — without any invalidation code to remember.
 *
 * The table is created on first use, like the platform's other `ensure*`
 * helpers, because a deployment can reach this code before any migration has
 * been applied.
 */

let translationsTableEnsured = false;

export async function ensureContentTranslationsTable() {
  if (translationsTableEnsured) return;
  await initDb();
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS content_translations (
            id SERIAL PRIMARY KEY,
            source_lang TEXT NOT NULL,
            target_lang TEXT NOT NULL,
            source_hash TEXT NOT NULL,
            source_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            provider TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )`,
    args: [],
  });
  await db.execute({
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_content_translations_key ON content_translations (source_lang, target_lang, source_hash)",
    args: [],
  });
  // Which Venture was last warmed, so the scheduled sweep rotates instead of
  // re-checking the same first page of Ventures forever.
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS content_translation_sweeps (
            venture_ref TEXT PRIMARY KEY,
            swept_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )`,
    args: [],
  });
  translationsTableEnsured = true;
}

/** The remembered translations among these hashes, for ONE language pair. */
export function selectContentTranslations({ sourceLang, targetLang, hashes = [] }) {
  if (!hashes.length) return Promise.resolve({ rows: [] });

  const placeholders = hashes.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT source_text, translated_text
            FROM content_translations
           WHERE source_lang = ? AND target_lang = ? AND source_hash IN (${placeholders})`,
    args: [sourceLang, targetLang, ...hashes],
  });
}

/**
 * Remember a batch of translations.
 *
 * `DO NOTHING` on conflict is the rule that keeps human corrections safe: once a
 * translation is in the memory, a later machine answer never overwrites it.
 */
export function insertContentTranslations(rows = []) {
  if (!rows.length) return Promise.resolve({ rows: [] });

  const values = rows.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
  const args = rows.flatMap((row) => [
    row.sourceLang,
    row.targetLang,
    row.sourceHash,
    row.sourceText,
    row.translatedText,
    row.provider ?? null,
  ]);

  return db.execute({
    sql: `INSERT INTO content_translations
            (source_lang, target_lang, source_hash, source_text, translated_text, provider)
          VALUES ${values}
          ON CONFLICT (source_lang, target_lang, source_hash) DO NOTHING`,
    args,
  });
}

/**
 * Ventures whose work has not been warmed for a while, oldest first.
 *
 * A Venture with no milestone and no task has no prose to translate, so it is
 * not listed at all. The sweep's own table is what makes the rotation fair:
 * without it, the same first page would be re-checked on every run and an older
 * Venture would never be reached.
 */
export function selectVenturesDueForTranslationSweep({ limit = 20, maxAgeMinutes = 60 } = {}) {
  const age = Math.max(0, Math.min(10080, parseInt(maxAgeMinutes, 10) || 60));
  const take = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));

  return db.execute({
    sql: `SELECT refs.venture_ref
            FROM (
              SELECT venture_id::text AS venture_ref
                FROM venture_milestones
               WHERE COALESCE(is_archived, FALSE) = FALSE
                 AND venture_id IS NOT NULL
              UNION
              SELECT venture_id::text AS venture_ref
                FROM venture_tasks
               WHERE COALESCE(is_archived, FALSE) = FALSE
                 AND venture_id IS NOT NULL
            ) refs
            LEFT JOIN content_translation_sweeps s ON s.venture_ref = refs.venture_ref
           WHERE s.swept_at IS NULL
              OR s.swept_at < NOW() - (? * INTERVAL '1 minute')
           ORDER BY s.swept_at NULLS FIRST
           LIMIT ?`,
    args: [age, take],
  });
}

/** Record that this Venture's work has just been warmed. */
export function markVentureTranslationSwept(ventureRef) {
  return db.execute({
    sql: `INSERT INTO content_translation_sweeps (venture_ref, swept_at)
          VALUES (?, NOW())
          ON CONFLICT (venture_ref) DO UPDATE SET swept_at = NOW()`,
    args: [String(ventureRef)],
  });
}
