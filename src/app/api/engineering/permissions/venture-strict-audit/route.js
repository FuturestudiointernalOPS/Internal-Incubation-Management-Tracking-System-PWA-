import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { authorize, getAuthorizationContext } from "@/lib/authorization";
import { resolveScopeIds } from "@/lib/authorization/scope";
import {
  listVentureRelationships,
  listAuditContacts,
  summarizeVentureStrictAudit,
} from "@/models/authorization/ventureScopeAudit";

export const dynamic = "force-dynamic";

/**
 * PHASE 5c — STRICT-MODE READINESS AUDIT (read-only).
 *
 * GET /api/engineering/permissions/venture-strict-audit
 *     requires permissions.view_matrix
 *
 * With the legacy gate removed, this answers — BEFORE anyone tests the app —
 * "who is attached to a venture but would be refused by the new gate, and
 * which key are they missing?" Nothing is granted or changed here.
 *
 * Report shape:
 *   { success, total, viewAllowed, viewMissing: [...], editMissing: [...],
 *     rows: [{ cid, name, role, ventures, scopeCount, viewAllowed, editAllowed,
 *              missing: ["ventures.view" | "ventures.edit"] }] }
 *
 * `?limit=N` caps the number of people evaluated (default 300) so the audit
 * stays a quick, safe read on a busy database.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 300, 1),
      1000,
    );

    const relationships = await listVentureRelationships();

    // Group ventures per person.
    const byCid = new Map();
    for (const rel of relationships) {
      const cid = String(rel.cid);
      if (!byCid.has(cid)) byCid.set(cid, []);
      byCid.get(cid).push(String(rel.venture_id));
    }
    const cids = [...byCid.keys()].slice(0, limit);

    const contacts = await listAuditContacts(cids);
    const contactByCid = new Map(contacts.map((c) => [String(c.cid), c]));

    const people = [];
    for (const cid of cids) {
      const contact = contactByCid.get(cid) || null;
      const sessionLike = {
        cid,
        role: contact?.role || null,
        email: contact?.email || null,
        name: contact?.name || null,
      };
      let viewAllowed = false;
      let editAllowed = false;
      try {
        const ctx = await getAuthorizationContext(sessionLike);
        viewAllowed = ctx?.isSuperAdmin || authorize(ctx, "ventures", "view");
        editAllowed = ctx?.isSuperAdmin || authorize(ctx, "ventures", "edit");
      } catch {
        // Fail closed: an unresolvable person is reported as missing.
        viewAllowed = false;
        editAllowed = false;
      }
      let scopeCount = 0;
      try {
        const ids = await resolveScopeIds("venture_own", cid, {
          email: sessionLike.email,
        });
        scopeCount = Array.isArray(ids) ? ids.length : 0;
      } catch {
        scopeCount = 0;
      }
      people.push({
        cid,
        name: sessionLike.name,
        role: sessionLike.role,
        ventures: byCid.get(cid),
        viewAllowed,
        editAllowed,
        scopeCount,
      });
    }

    const summary = summarizeVentureStrictAudit(people);

    return NextResponse.json({
      success: true,
      evaluated: people.length,
      relationships: relationships.length,
      total: summary.total,
      viewAllowed: summary.viewAllowed,
      viewMissing: summary.viewMissing,
      editMissing: summary.editMissing,
      rows: summary.rows,
    });
  } catch (err) {
    console.error("[Venture Strict Audit] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
