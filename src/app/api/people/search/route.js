import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { requireAuthorization } from "@/models/authorization/index";
import { selectContactsByTerm } from "@/models/contactLookupStore";

export const dynamic = "force-dynamic";

/**
 * GET /api/people/search?q=… — the people picker's read.
 *
 * Answers "who is already here?" WHILE an address is being typed. That matters
 * for session guests: an address ImpactOS already knows belongs to a person
 * whose own calendar the session can reach, while a look-alike address that
 * belongs to nobody only ever gets an e-mail. The picker should offer the
 * person.
 *
 * A READ, so it asks for `contacts.view` — not the `contacts.create` that
 * writing a new person through /api/people needs. It returns the same fields
 * that lookup already shows (cid, name, email, role, status) and nothing more.
 *
 * Thin controller: no SQL (see @/models/contactLookupStore), no decisions
 * beyond reading the query and shaping the answer.
 */

/** A term shorter than this cannot narrow a directory — return nothing. */
const MIN_TERM_LENGTH = 2;

/** How many people the picker may show at once. */
const LIMIT = 8;

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    // `%` and `_` are LIKE wildcards, not parts of a name or an address: strip
    // them so a term can never widen the search into the whole table.
    const term = String(new URL(req.url).searchParams.get("q") || "")
      .trim()
      .toLowerCase()
      .replace(/[%_\\]/g, "");

    if (term.length < MIN_TERM_LENGTH) {
      return NextResponse.json({ success: true, people: [] });
    }

    const { rows } = await selectContactsByTerm(term, LIMIT);

    return NextResponse.json({
      success: true,
      people: (rows || []).map((row) => ({
        cid: row.cid,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
      })),
    });
  } catch (error) {
    console.error("[people/search]", error);
    return NextResponse.json(
      { success: false, error: "errors.somethingWrong" },
      { status: 500 },
    );
  }
}
