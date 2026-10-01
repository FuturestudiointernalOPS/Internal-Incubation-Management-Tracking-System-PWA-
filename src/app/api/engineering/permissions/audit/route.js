import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  countPermissionAudits,
  listPermissionAudits,
} from "@/models/authorization";
import {
  buildAuditFilters,
  resolveAuditPagination,
} from "@/services/authorization/auditViewer";

/**
 * GET /api/engineering/permissions/audit
 *
 * READ-ONLY permission audit viewer (Phase 7). Consumes the existing
 * permission_audit_log records — there is no write endpoint here; audit
 * records are append-only history.
 *
 * Query params (all optional, server-side filtered + paginated):
 *   q           — free-text search across actor/target names, action,
 *                 module, capability and details
 *   actor       — exact actor name (LIKE)
 *   target      — exact target name (LIKE)
 *   action      — exact action
 *   module      — exact module
 *   capability  — exact capability (LIKE)
 *   target_cid  — exact target contact cid
 *   from / to   — ISO date range on created_at (inclusive)
 *   page        — 1-based page number (default 1)
 *   pageSize    — rows per page (default 25, max 100)
 *
 * Response: { success, entries, total, page, pageSize }
 */
export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    const { searchParams } = new URL(req.url);

    const { whereSql, args } = buildAuditFilters({
      q: searchParams.get("q"),
      actor: searchParams.get("actor"),
      target: searchParams.get("target"),
      action: searchParams.get("action"),
      module: searchParams.get("module"),
      capability: searchParams.get("capability"),
      target_cid: searchParams.get("target_cid"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    const { page, pageSize, offset } = resolveAuditPagination(
      searchParams.get("page"),
      searchParams.get("pageSize"),
    );

    const countResult = await countPermissionAudits(whereSql, args);
    const total = parseInt(countResult.rows[0]?.n || 0);

    const entries = (
      await listPermissionAudits(whereSql, [...args, pageSize, offset])
    ).rows;

    return NextResponse.json({ success: true, entries, total, page, pageSize });
  } catch (error) {
    console.error("[Permissions] Audit GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}