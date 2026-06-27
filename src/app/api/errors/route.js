import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Auto-categorize an error based on its properties.
 */
function categorizeError({ message, status_code, method, endpoint, stack }) {
  const msg = (message || "").toLowerCase();
  const ep = (endpoint || "").toLowerCase();

  if (status_code >= 500) return "server_error";
  if (status_code === 404) return "not_found";
  if (status_code === 403 || status_code === 401) return "auth_error";
  if (status_code === 422 || status_code === 400) return "validation_error";
  if (
    msg.includes("typeerror") ||
    msg.includes("cannot read property") ||
    msg.includes("undefined")
  )
    return "runtime_error";
  if (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("econnrefused")
  )
    return "network_error";
  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("database") || msg.includes("sql") || msg.includes("query"))
    return "database_error";
  if (msg.includes("chunkload") || msg.includes("loading chunk"))
    return "build_error";
  if (ep.includes("/api/")) return "api_error";
  if (msg.includes("permission") || msg.includes("unauthorized"))
    return "auth_error";

  return "uncategorized";
}

/**
 * Build a fingerprint for deduplication.
 */
function buildFingerprint({ message, page }) {
  // Normalize: lowercase, trim, remove dynamic values like IDs
  const normalized = (message || "")
    .toLowerCase()
    .replace(/\b[a-f0-9]{8,}\b/g, "<id>") // hex IDs
    .replace(/\b\d{5,}\b/g, "<num>") // long numbers
    .replace(/\buser_\w+/gi, "<user>") // user IDs
    .trim()
    .substring(0, 200);
  return `${normalized}|${page || "unknown"}`;
}

/**
 * POST /api/errors — Accepts error reports with deduplication and categorization.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      message,
      stack,
      url,
      user_id,
      user_name,
      user_role,
      user_agent,
      severity,
      status_code,
      method,
      endpoint,
      request_body,
      page,
      action_attempted,
    } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 },
      );
    }

    await initDb();

    const category = categorizeError(body);
    const fingerprint = buildFingerprint(body);

    // Dedup: check if same fingerprint exists within last 24 hours and is unresolved
    const existing = await db.execute({
      sql: `SELECT id, occurrence_count FROM error_logs
            WHERE fingerprint = ?
              AND created_at > NOW() - INTERVAL '24 hours'
              AND (resolved IS NULL OR resolved = false)
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [fingerprint],
    });

    if (existing.rows.length > 0) {
      // Increment occurrence count
      const err = existing.rows[0];
      const newCount = (parseInt(err.occurrence_count) || 1) + 1;
      await db.execute({
        sql: `UPDATE error_logs
              SET occurrence_count = ?, created_at = NOW(), user_id = ?, user_name = ?, user_role = ?, page = ?, action_attempted = ?, url = ?, status_code = ?, method = ?, endpoint = ?, request_body = ?, user_agent = ?, severity = ?, stack = ?
              WHERE id = ?`,
        args: [
          newCount,
          user_id || null,
          user_name || null,
          user_role || null,
          page || null,
          action_attempted || null,
          url || null,
          status_code || null,
          method || null,
          endpoint || null,
          request_body || null,
          user_agent || null,
          severity || "error",
          stack || null,
          err.id,
        ],
      });

      return NextResponse.json({
        success: true,
        id: err.id,
        deduplicated: true,
        occurrence_count: newCount,
      });
    }

    // New error — insert with category and fingerprint
    const result = await db.execute({
      sql: `INSERT INTO error_logs
            (message, stack, url, user_id, user_name, user_role, user_agent,
             severity, status_code, method, endpoint, request_body,
             page, action_attempted, category, fingerprint, occurrence_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            RETURNING id`,
      args: [
        message,
        stack || null,
        url || null,
        user_id || null,
        user_name || null,
        user_role || null,
        user_agent || null,
        severity || "error",
        status_code || null,
        method || null,
        endpoint || null,
        request_body || null,
        page || null,
        action_attempted || null,
        category,
        fingerprint,
      ],
    });

    const newId = result.rows?.[0]?.id || result.lastInsertRowid;
    return NextResponse.json({
      success: true,
      id: newId,
      deduplicated: false,
      category,
    });
  } catch (err) {
    console.error("[API errors] POST failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/errors — Returns error logs with optional filtering.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const resolved = searchParams.get("resolved");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    await initDb();

    let sql = "SELECT * FROM error_logs WHERE 1=1";
    const args = [];

    if (severity) {
      sql += " AND severity = ?";
      args.push(severity);
    }

    if (resolved === "true") {
      sql += " AND resolved = true";
    } else if (resolved === "false") {
      sql += " AND (resolved IS NULL OR resolved = false)";
    }

    if (category) {
      sql += " AND category = ?";
      args.push(category);
    }

    if (search) {
      sql += " AND message ILIKE ?";
      args.push(`%${search}%`);
    }

    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });

    return NextResponse.json({ success: true, errors: result.rows });
  } catch (err) {
    console.error("[API errors] GET failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/errors — Updates an error log's status.
 */
export async function PATCH(request) {
  try {
    const { id, resolved, resolution_notes, task_id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    await initDb();

    if (typeof resolved === "boolean") {
      await db.execute({
        sql: "UPDATE error_logs SET resolved = ?, resolution_notes = ?, resolved_at = CASE WHEN ? THEN NOW() ELSE NULL END WHERE id = ?",
        args: [
          resolved ? 1 : 0,
          resolution_notes || null,
          resolved ? 1 : 0,
          id,
        ],
      });
    } else if (resolution_notes !== undefined) {
      await db.execute({
        sql: "UPDATE error_logs SET resolution_notes = ? WHERE id = ?",
        args: [resolution_notes, id],
      });
    }

    if (task_id !== undefined) {
      await db.execute({
        sql: "UPDATE error_logs SET task_id = ? WHERE id = ?",
        args: [task_id, id],
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API errors] PATCH failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
