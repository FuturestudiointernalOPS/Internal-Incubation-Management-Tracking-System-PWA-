import db from "@/lib/db";
import { getActiveCheckoutRunSlugForCourse } from "./public";
import { resolveCheckoutCourse } from "@/services/lms/checkout";

/**
 * FIND A COURSE BY NAME
 *
 * The website does not hold a course's identifier: it names the program it is
 * selling ("launchlab") and ImpactOS answers with the Execution that sells the
 * best-matching course, at the price the platform will charge. So the ONLY
 * value the site keeps is the program's name — the address and the price stay
 * on this side.
 *
 * Matching is deliberately forgiving but conservative: a course is a candidate
 * only for a real correspondence (the whole name, a prefix, or shared words),
 * never for chance. Among the candidates, the first one that is actually SOLD
 * (paid + an active Execution attached) wins, because a name match alone gives
 * the visitor nothing to click.
 */

/** Fold a name to compare it: lowercase, accents removed, letters/digits only. */
export function nameKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** The words of a name, accent-folded, keeping only meaningful ones. */
function nameWords(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
}

/**
 * How well a query names a title. 0 means "not a match at all" — the caller
 * treats it as no candidate. Higher is better.
 */
export function nameScore(query, title) {
  const q = nameKey(query);
  const t = nameKey(title);
  if (!q || !t) return 0;
  if (q === t) return 1000;
  if (t.startsWith(q)) return 800;
  if (q.startsWith(t)) return 600;
  if (t.includes(q)) return 500;

  const titleWords = new Set(nameWords(title));
  const queryWords = nameWords(query);
  if (queryWords.length === 0) return 0;
  const hits = queryWords.filter((word) => titleWords.has(word)).length;
  return hits > 0 ? Math.round((hits / queryWords.length) * 300) : 0;
}

/**
 * The best-matching public course and, when it is sold, its checkout.
 *
 * Answers with `match: null` when nothing corresponds — the website then keeps
 * its own fallback instead of being sent somewhere that grants nothing.
 */
export async function findCourseMatch(name) {
  const query = String(name || "").trim();
  if (!query) return { match: null, checkout: null };

  const res = await db.execute({
    sql: "SELECT id, title, updated_at FROM lms_courses WHERE status = ? AND visibility = ?",
    args: ["published", "public"],
  });

  const candidates = res.rows
    .map((row) => ({
      id: String(row.id),
      title: row.title,
      score: nameScore(query, row.title),
      updatedAt: row.updated_at,
    }))
    .filter((course) => course.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")),
    );

  if (candidates.length === 0) return { match: null, checkout: null };

  for (const candidate of candidates.slice(0, 5)) {
    const runSlug = await getActiveCheckoutRunSlugForCourse(candidate.id);
    if (!runSlug) continue;
    const sale = await resolveCheckoutCourse(candidate.id);
    if (!sale) continue;
    return {
      match: { title: candidate.title, score: candidate.score },
      checkout: {
        run_slug: runSlug,
        amount: sale.amount,
        currency: sale.currency,
        consent_text: sale.consentText,
      },
    };
  }

  const best = candidates[0];
  return {
    match: { title: best.title, score: best.score },
    checkout: null,
  };
}
