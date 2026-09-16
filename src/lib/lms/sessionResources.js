import db from "@/lib/db";
import { LmsError } from "./errors";
import { nextPosition } from "./helpers";
import { LMS_RESOURCE_KINDS, LMS_RESOURCE_SOURCES } from "./constants";
import {
  isManagedStoragePath,
  removeSessionResourceFile,
} from "./sessionResourceFiles";

/**
 * SESSION RESOURCES & RECOMMENDATIONS (Phase 8)
 *
 * Course content lives in the LMS (`lms_courses`); a PROGRAM session is the
 * moment where learners need supporting material. This module stores that
 * material as first-class rows instead of opaque JSON:
 *
 *   program session → lms_session_resources (kind: 'video' | 'document')
 *                     └─ is_recommended + recommendation_note = the
 *                        "recommended for this session" signal learners see.
 *
 * Rules:
 *   - Additive domain: nothing is derived from `v2_sessions.extra_materials`
 *     (that legacy JSON stays untouched) — resources are queryable rows.
 *   - `program_id` / `session_id` carry TEXT ids without FK (see
 *     docs/LMS_ARCHITECTURE.md §8) — existence is validated here, in service
 *     code, exactly like `lms_program_requirements`.
 *   - A resource WITHOUT a link is useless, so `url` is required and must be an
 *     absolute http(s) URL (no `javascript:`, no relative path). `url` holds
 *     EITHER the external link (source 'link') OR the public URL of the file
 *     uploaded through ImpactOS (source 'upload'), which also carries the
 *     storage path, filename, size and mime type.
 *   - Mutations are gated by `lms.assign` at the route layer (Program Course
 *     Assignment) and reads by `lms.view`; learners never call this module
 *     directly — the participant surface reads the same rows through the
 *     program detail payload.
 */

export const RESOURCE_KINDS = LMS_RESOURCE_KINDS;
export const RESOURCE_SOURCES = LMS_RESOURCE_SOURCES;

/** Longest accepted link/text lengths — mirrors the UI contract. */
const MAX_URL_LENGTH = 2000;
const MAX_TITLE_LENGTH = 200;

function parseResource(row) {
  if (!row) return null;
  return {
    id: row.id,
    program_id: row.program_id,
    session_id: row.session_id ?? null,
    week_number: row.week_number ?? null,
    kind: row.kind,
    title: row.title,
    description: row.description ?? null,
    url: row.url ?? null,
    source: row.source || "link",
    storage_path: row.storage_path ?? null,
    file_name: row.file_name ?? null,
    file_size: row.file_size ?? null,
    mime_type: row.mime_type ?? null,
    is_recommended: row.is_recommended === true || row.is_recommended === 1,
    recommendation_note: row.recommendation_note ?? null,
    position: row.position ?? 0,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Normalize + validate a resource link. Returns the trimmed URL. */
function normalizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new LmsError("lms.errors.resourceUrlRequired", 400);
  if (raw.length > MAX_URL_LENGTH) throw new LmsError("lms.errors.resourceUrlInvalid", 400);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new LmsError("lms.errors.resourceUrlInvalid", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LmsError("lms.errors.resourceUrlInvalid", 400);
  }
  // The raw value is stored as typed: normalization would rewrite links like
  // Google Docs URLs whose exact form matters to the provider.
  return raw;
}

function normalizeKind(value) {
  const kind = String(value ?? "").trim().toLowerCase();
  if (!kind) return "document";
  if (!RESOURCE_KINDS.includes(kind)) {
    throw new LmsError("lms.errors.invalidResourceKind", 400);
  }
  return kind;
}

function normalizeTitle(value) {
  const title = String(value ?? "").trim();
  if (!title) throw new LmsError("lms.errors.resourceTitleRequired", 400);
  return title.slice(0, MAX_TITLE_LENGTH);
}

function normalizeSource(value) {
  const source = String(value ?? "").trim().toLowerCase();
  if (!source) return "link";
  if (!RESOURCE_SOURCES.includes(source)) {
    throw new LmsError("lms.errors.invalidResourceSource", 400);
  }
  return source;
}

/**
 * An uploaded resource must carry the storage path (the handle used to delete
 * the object later) on top of its public URL.
 */
function assertUploadMetadata(source, url, storagePath) {
  if (source !== "upload") return;
  if (!storagePath) throw new LmsError("lms.errors.resourceFileRequired", 400);
  if (!url) throw new LmsError("lms.errors.resourceUrlRequired", 400);
  // Only objects this domain created can ever be referenced — a caller cannot
  // point a resource at (and later delete) an unrelated stored object.
  if (!isManagedStoragePath(storagePath)) {
    throw new LmsError("lms.errors.resourceFileRequired", 400);
  }
}

/** Program must exist (v2_programs; TEXT id — validated in service code, no FK). */
async function assertProgramExists(programId) {
  const res = await db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [String(programId)],
  });
  if (res.rows.length === 0) {
    throw new LmsError("lms.errors.programNotFound", 404);
  }
}

/** Session must exist and belong to the program; returns its week number. */
async function assertSessionBelongsToProgram(sessionId, programId) {
  const res = await db.execute({
    sql: "SELECT id, program_id, week_number FROM v2_sessions WHERE id = ?",
    args: [String(sessionId)],
  });
  const session = res.rows[0];
  if (!session) throw new LmsError("lms.errors.sessionNotFound", 404);
  if (programId != null && String(session.program_id) !== String(programId)) {
    throw new LmsError("lms.errors.sessionNotFound", 404);
  }
  return session;
}

export async function getSessionResource(resourceId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_session_resources WHERE id = ?",
    args: [resourceId],
  });
  return parseResource(res.rows[0]);
}

/**
 * Resources for a program, optionally narrowed to one session or week.
 * Recommendations are always returned and flagged — callers decide whether to
 * split them into their own section (`is_recommended`).
 */
export async function listSessionResources({
  programId,
  sessionId,
  weekNumber,
  onlyRecommended,
} = {}) {
  if (!programId) throw new LmsError("lms.errors.programIdRequired", 400);

  const clauses = ["program_id = ?"];
  const args = [String(programId)];
  if (sessionId) {
    clauses.push("session_id = ?");
    args.push(String(sessionId));
  }
  if (weekNumber != null && weekNumber !== "") {
    clauses.push("week_number = ?");
    args.push(Number(weekNumber));
  }
  if (onlyRecommended) {
    clauses.push("is_recommended = ?");
    args.push(true);
  }

  const res = await db.execute({
    sql: `SELECT * FROM lms_session_resources WHERE ${clauses.join(
      " AND ",
    )} ORDER BY position, created_at`,
    args,
  });
  return res.rows.map(parseResource);
}

/**
 * Resources grouped by session id — used by the participant program payload so
 * each week can render its material without one query per session.
 */
export async function listSessionResourcesBySession(programId) {
  const resources = await listSessionResources({ programId });
  const bySession = new Map();
  for (const resource of resources) {
    const key = resource.session_id != null ? String(resource.session_id) : "";
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(resource);
  }
  return bySession;
}

export async function createSessionResource({
  programId,
  sessionId,
  weekNumber,
  kind,
  title,
  description,
  url,
  source,
  storagePath,
  fileName,
  fileSize,
  mimeType,
  isRecommended,
  recommendationNote,
  createdBy,
}) {
  if (!programId) throw new LmsError("lms.errors.programIdRequired", 400);
  await assertProgramExists(programId);

  let resolvedWeek = weekNumber != null && weekNumber !== "" ? Number(weekNumber) : null;
  if (sessionId) {
    const session = await assertSessionBelongsToProgram(sessionId, programId);
    if (resolvedWeek == null) resolvedWeek = session.week_number ?? null;
  }

  const position = await nextPosition(
    "lms_session_resources",
    sessionId ? "session_id" : "program_id",
    sessionId ? String(sessionId) : String(programId),
  );

  const recommended = isRecommended === true;
  const resolvedSource = normalizeSource(source);
  assertUploadMetadata(resolvedSource, url, storagePath);

  const res = await db.execute({
    sql: `INSERT INTO lms_session_resources
            (program_id, session_id, week_number, kind, title, description, url,
             source, storage_path, file_name, file_size, mime_type,
             is_recommended, recommendation_note, position, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      String(programId),
      sessionId ? String(sessionId) : null,
      resolvedWeek,
      normalizeKind(kind),
      normalizeTitle(title),
      description ? String(description).trim() : null,
      normalizeUrl(url),
      resolvedSource,
      resolvedSource === "upload" ? String(storagePath).trim() : null,
      resolvedSource === "upload" && fileName ? String(fileName).trim() : null,
      resolvedSource === "upload" && fileSize != null ? Number(fileSize) : null,
      resolvedSource === "upload" && mimeType ? String(mimeType).trim() : null,
      recommended,
      recommended && recommendationNote ? String(recommendationNote).trim() : null,
      position,
      createdBy || null,
    ],
  });
  return parseResource(res.rows[0]);
}

export async function updateSessionResource(resourceId, fields = {}) {
  const existing = await getSessionResource(resourceId);
  if (!existing) throw new LmsError("lms.errors.resourceNotFound", 404);

  const sets = [];
  const args = [];

  if (fields.kind !== undefined) {
    sets.push("kind = ?");
    args.push(normalizeKind(fields.kind));
  }
  if (fields.title !== undefined) {
    sets.push("title = ?");
    args.push(normalizeTitle(fields.title));
  }
  if (fields.description !== undefined) {
    sets.push("description = ?");
    args.push(fields.description ? String(fields.description).trim() : null);
  }
  if (fields.url !== undefined) {
    sets.push("url = ?");
    args.push(normalizeUrl(fields.url));
  }
  if (fields.source !== undefined) {
    sets.push("source = ?");
    args.push(normalizeSource(fields.source));
  }
  if (fields.storage_path !== undefined) {
    sets.push("storage_path = ?");
    args.push(fields.storage_path ? String(fields.storage_path).trim() : null);
  }
  if (fields.file_name !== undefined) {
    sets.push("file_name = ?");
    args.push(fields.file_name ? String(fields.file_name).trim() : null);
  }
  if (fields.file_size !== undefined) {
    sets.push("file_size = ?");
    args.push(fields.file_size != null ? Number(fields.file_size) : null);
  }
  if (fields.mime_type !== undefined) {
    sets.push("mime_type = ?");
    args.push(fields.mime_type ? String(fields.mime_type).trim() : null);
  }
  if (fields.is_recommended !== undefined) {
    sets.push("is_recommended = ?");
    args.push(fields.is_recommended === true);
  }
  if (fields.recommendation_note !== undefined) {
    sets.push("recommendation_note = ?");
    args.push(
      fields.recommendation_note ? String(fields.recommendation_note).trim() : null,
    );
  }
  if (fields.position !== undefined) {
    sets.push("position = ?");
    args.push(Number(fields.position) || 0);
  }

  if (sets.length === 0) return existing;
  sets.push("updated_at = NOW()");
  args.push(resourceId);
  await db.execute({
    sql: `UPDATE lms_session_resources SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  const updated = await getSessionResource(resourceId);

  // Replacing an uploaded file leaves the previous object orphaned in storage:
  // drop it (best-effort — the row is already correct).
  if (
    existing.source === "upload" &&
    existing.storage_path &&
    String(existing.storage_path) !== String(updated.storage_path || "")
  ) {
    await removeSessionResourceFile(existing.storage_path);
  }
  return updated;
}

export async function deleteSessionResource(resourceId) {
  const existing = await getSessionResource(resourceId);
  if (!existing) throw new LmsError("lms.errors.resourceNotFound", 404);
  await db.execute({
    sql: "DELETE FROM lms_session_resources WHERE id = ?",
    args: [resourceId],
  });
  // The row is gone; the file should not outlive it (best-effort, never throws).
  if (existing.source === "upload" && existing.storage_path) {
    await removeSessionResourceFile(existing.storage_path);
  }
  return { success: true, id: resourceId };
}
