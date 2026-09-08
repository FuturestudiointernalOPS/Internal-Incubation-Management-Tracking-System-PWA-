import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  findRecentErrorByFingerprint,
  findRecentErrorByMessageAndPage,
  incrementErrorOccurrence,
  insertErrorLog,
  listErrorLogs,
  updateErrorResolution,
  updateErrorResolutionNotes,
  updateErrorTaskId,
} from "@/models/adminOps";

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
    const { message, page } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 },
      );
    }

    await initDb();

    const category = categorizeError(body);
    const fingerprint = buildFingerprint(body);

    // Dedup: check if same error exists within last 24 hours and is unresolved
    let existing = null;
    try {
      const result = await findRecentErrorByFingerprint(fingerprint);
      existing = result.rows[0] || null;
    } catch (_) {
      // fingerprint column may not exist yet — fallback to message+page matching
      try {
        const result = await findRecentErrorByMessageAndPage(message, page);
        existing = result.rows[0] || null;
      } catch (_) {
        existing = null;
      }
    }

    if (existing) {
      // Increment occurrence count
      const err = existing;
      const newCount = (parseInt(err.occurrence_count) || 1) + 1;
      await incrementErrorOccurrence(err.id, newCount, body);

      return NextResponse.json({
        success: true,
        id: err.id,
        deduplicated: true,
        occurrence_count: newCount,
      });
    }

    // New error — insert with category and fingerprint
    const result = await insertErrorLog(body, category, fingerprint);

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
 * Phase 8: now gated behind engineering.manage_errors (was PUBLIC).
 */
export async function GET(request) {
  try {
    const capError = await requireAuthorization("engineering", "manage_errors");
    if (capError) return capError;
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const resolved = searchParams.get("resolved");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    await initDb();

    const result = await listErrorLogs({ severity, resolved, category, search });

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
 * Phase 8: now gated behind engineering.manage_errors (was PUBLIC).
 */
export async function PATCH(request) {
  try {
    const capError = await requireAuthorization("engineering", "manage_errors");
    if (capError) return capError;
    const { id, resolved, resolution_notes, task_id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    await initDb();

    if (typeof resolved === "boolean") {
      await updateErrorResolution(id, resolved, resolution_notes);
    } else if (resolution_notes !== undefined) {
      await updateErrorResolutionNotes(id, resolution_notes);
    }

    if (task_id !== undefined) {
      await updateErrorTaskId(id, task_id);
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
