import { NextResponse } from "next/server";
import db from "@/lib/db";

/**
 * OBJECT-LEVEL AUTHORIZATION FOR VENTURE RESOURCES
 *
 * Every route under /api/ventures/[id] first proves the caller may act on the
 * venture named in the URL. That is NOT enough: the row ids a request carries
 * (task, milestone, document, session, …) come from the client too. Without
 * binding them to the venture, an editor of venture A can read or destroy a row
 * belonging to venture B simply by sending B's row id.
 *
 * The pattern is therefore always: load the row, ask `ventureOwned(row, …)`,
 * and refuse when it does not belong.
 */

/** A 404 that does not reveal whether the row exists in some other venture. */
export function ventureNotFound() {
  return NextResponse.json(
    { success: false, error: "errors.notFound" },
    { status: 404 },
  );
}

/**
 * True when `row.venture_id` is one of the accepted venture identifiers.
 *
 * Accepts several ids on purpose: the resolved numeric venture id is what the
 * tables store today, but some legacy rows and joins key on the human code
 * (VNT-…), so both are passed in.
 */
export function ventureOwned(row, ...ventureIds) {
  if (!row) return false;
  const value = row.venture_id;
  if (value === null || value === undefined) return false;
  return ventureIds.some(
    (ventureId) =>
      ventureId !== null &&
      ventureId !== undefined &&
      String(ventureId) === String(value),
  );
}

/**
 * The numeric venture id behind either form of the path parameter (the human
 * code `VNT-…` or the numeric id). Some venture tables key on the code and some
 * on the numeric id, so a scope check compares against both.
 */
export async function resolveVentureDbId(scopeId) {
  const result = await db
    .execute({
      sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?",
      args: [scopeId, scopeId],
    })
    .catch(() => ({ rows: [] }));
  return result.rows?.[0]?.id ?? null;
}

