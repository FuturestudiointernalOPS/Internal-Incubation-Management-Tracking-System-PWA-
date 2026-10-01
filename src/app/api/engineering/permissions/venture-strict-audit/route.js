import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  listVentureRelationships,
  listAuditContacts,
} from "@/models/authorization/ventureScopeAudit";
import {
  resolveAuditLimit,
  groupVenturesByCid,
  selectAuditedCids,
  auditPerson,
  summarizeVentureStrictAudit,
} from "@/services/authorization/ventureStrictAudit";

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
    const limit = resolveAuditLimit(searchParams.get("limit"));

    const relationships = await listVentureRelationships();

    const venturesByCid = groupVenturesByCid(relationships);
    const contactCids = selectAuditedCids(venturesByCid, limit);

    const contacts = await listAuditContacts(contactCids);
    const contactByCid = new Map(
      contacts.map((contact) => [String(contact.cid), contact]),
    );

    // Sequential on purpose: one person is probed at a time so a single broken
    // person cannot fan out into concurrent grants/scope reads.
    const people = [];
    for (const cid of contactCids) {
      people.push(await auditPerson(cid, contactByCid.get(cid) || null, venturesByCid.get(cid)));
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
  } catch (error) {
    console.error("[Venture Strict Audit] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}