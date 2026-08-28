import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";

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

    const q = searchParams.get("q")?.trim();
    const actor = searchParams.get("actor")?.trim();
    const target = searchParams.get("target")?.trim();
    const action = searchParams.get("action")?.trim();
    const module = searchParams.get("module")?.trim();
    const capability = searchParams.get("capability")?.trim();
    const targetCid = searchParams.get("target_cid")?.trim();
    const from = searchParams.get("from")?.trim();
    const to = searchParams.get("to")?.trim();
    const page = Math.max(parseInt(searchParams.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize")) || 25, 1), 100);
    const offset = (page - 1) * pageSize;

    const where = [];
    const args = [];
    if (q) {
      const like = `%${q}%`;
      where.push(
        "(actor_name ILIKE ? OR target_name ILIKE ? OR action ILIKE ? OR module ILIKE ? OR capability ILIKE ? OR details ILIKE ?)",
      );
      args.push(like, like, like, like, like, like);
    }
    if (actor) {
      where.push("actor_name ILIKE ?");
      args.push(`%${actor}%`);
    }
    if (target) {
      where.push("target_name ILIKE ?");
      args.push(`%${target}%`);
    }
    if (action) {
      where.push("action = ?");
      args.push(action);
    }
    if (module) {
      where.push("module = ?");
      args.push(module);
    }
    if (capability) {
      where.push("capability ILIKE ?");
      args.push(`%${capability}%`);
    }
    if (targetCid) {
      where.push("target_cid = ?");
      args.push(targetCid);
    }
    if (from) {
      where.push("created_at >= ?");
      args.push(new Date(from).toISOString());
    }
    if (to) {
      where.push("created_at <= ?");
      args.push(new Date(to).toISOString());
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM permission_audit_log ${whereSql}`,
      args,
    });
    const total = parseInt(countRes.rows[0]?.n || 0);

    const entries = (
      await db.execute({
        sql: `SELECT id, actor_cid, actor_name, target_cid, target_name,
                     action, module, capability, previous_value, new_value,
                     details, created_at
              FROM permission_audit_log
              ${whereSql}
              ORDER BY created_at DESC, id DESC
              LIMIT ? OFFSET ?`,
        args: [...args, pageSize, offset],
      })
    ).rows;

    return NextResponse.json({ success: true, entries, total, page, pageSize });
  } catch (err) {
    console.error("[Permissions] Audit GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
