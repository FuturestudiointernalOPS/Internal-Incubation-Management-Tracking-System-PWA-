import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * POST /api/errors — Accepts error reports from client-side.
 */
export async function POST(request) {
  try {
    const {
      message,
      stack,
      url,
      user_id,
      user_agent,
      severity,
      status_code,
      method,
      endpoint,
      request_body,
    } = await request.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 },
      );
    }

    const dbInstance = await initDb();

    await dbInstance.execute({
      sql: `INSERT INTO error_logs (message, stack, url, user_id, user_agent, severity, status_code, method, endpoint, request_body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        message,
        stack || null,
        url || null,
        user_id || null,
        user_agent || null,
        severity || "error",
        status_code || null,
        method || null,
        endpoint || null,
        request_body || null,
      ],
    });

    return NextResponse.json({ success: true });
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
    const search = searchParams.get("search");

    const dbInstance = await initDb();

    let sql = "SELECT * FROM error_logs WHERE 1=1";
    const args = [];

    if (severity) {
      sql += " AND severity = ?";
      args.push(severity);
    }

    if (resolved === "true") {
      sql += " AND resolved = 1";
    } else if (resolved === "false") {
      sql += " AND (resolved IS NULL OR resolved = 0)";
    }

    if (search) {
      sql += " AND message ILIKE ?";
      args.push(`%${search}%`);
    }

    sql += " ORDER BY created_at DESC";

    const result = await dbInstance.execute({ sql, args });

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
    const { id, resolved, resolution_notes } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const dbInstance = await initDb();

    if (typeof resolved === "boolean") {
      await dbInstance.execute({
        sql: "UPDATE error_logs SET resolved = ?, resolution_notes = ?, resolved_at = CASE WHEN ? THEN NOW() ELSE NULL END WHERE id = ?",
        args: [
          resolved ? 1 : 0,
          resolution_notes || null,
          resolved ? 1 : 0,
          id,
        ],
      });
    } else if (resolution_notes !== undefined) {
      await dbInstance.execute({
        sql: "UPDATE error_logs SET resolution_notes = ? WHERE id = ?",
        args: [resolution_notes, id],
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
