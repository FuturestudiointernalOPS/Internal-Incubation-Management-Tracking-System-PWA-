import db from "@/lib/db";
import { LmsError } from "./errors";
import { nextPosition } from "./helpers";
import { LMS_RESOURCE_KINDS, LMS_RESOURCE_SOURCES } from "./constants";
import {
  isManagedStoragePath,
  removeSectionResourceFile,
  signSectionResourcePath,
} from "@/lib/lms/sectionResourceFiles";

/**
 * SECTION RESOURCES & RECOMMENDATIONS
 *
 * A course SECTION (an "LMS session") carries its own supporting material as
 * first-class rows instead of opaque JSON:
 *
 *   course section → lms_section_resources (kind: 'video' | 'document')
 *                    └─ is_recommended + recommendation_note = the
 *                       "recommended for this section" signal learners see.
 *
 * Rules:
 *   - `section_id` is a real UUID FK (ON DELETE CASCADE) — the material dies
 *     with its section, so there is no orphan row to clean up.
 *   - A resource WITHOUT a link is useless, so `url` is required and must be an
 *     absolute http(s) URL (no `javascript:`, no relative path). `url` holds
 *     EITHER the external link (source 'link') OR the public URL of the file
 *     uploaded through ImpactOS (source 'upload'), which also carries the
 *     storage path, filename, size and mime type.
 *   - Mutations are gated by `lms.edit` at the route layer (the canonical
 *     course-authoring gate) and reads by `lms.view`. Learners never call this
 *     module directly — the learner course payload reads the same rows through
 *     `learnerSectionResourcesByCourse`.
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
    section_id: row.section_id ?? null,
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

/**
 * The section must exist; its row also tells the caller which course it belongs
 * to (used to shape the upload path). Queried directly rather than through the
 * sections module so this file stays free of an import cycle.
 */
async function assertSectionExists(sectionId) {
  const res = await db.execute({
    sql: "SELECT id, course_id FROM lms_course_sections WHERE id = ?",
    args: [String(sectionId)],
  });
  const section = res.rows[0];
  if (!section) throw new LmsError("lms.errors.sectionNotFound", 404);
  return section;
}

export async function getSectionResource(resourceId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_section_resources WHERE id = ?",
    args: [resourceId],
  });
  return parseResource(res.rows[0]);
}

/**
 * Resources of one section. Recommendations are always returned and flagged —
 * callers decide whether to split them into their own block.
 */
export async function listSectionResources({ sectionId } = {}) {
  if (!sectionId) throw new LmsError("lms.errors.sectionNotFound", 400);
  const res = await db.execute({
    sql: `SELECT * FROM lms_section_resources
          WHERE section_id = ?
          ORDER BY position, created_at`,
    args: [String(sectionId)],
  });
  return res.rows.map(parseResource);
}

/** Group a resource list by section id. */
function groupBySection(resources) {
  const bySection = new Map();
  for (const resource of resources) {
    const key = String(resource.section_id);
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(resource);
  }
  return bySection;
}

/**
 * Every section's material for one course, grouped by section id — the read used
 * by the course structure payload, so a course page needs one query rather than
 * one per section. The section ids are resolved first (no JOIN: the domain reads
 * stay within one table each).
 */
export async function listSectionResourcesByCourse(courseId) {
  const sectionsRes = await db.execute({
    sql: "SELECT id FROM lms_course_sections WHERE course_id = ?",
    args: [String(courseId)],
  });
  const sectionIds = sectionsRes.rows.map((s) => String(s.id));
  if (sectionIds.length === 0) return new Map();

  const res = await db.execute({
    sql: `SELECT * FROM lms_section_resources
          WHERE section_id IN (${sectionIds.map(() => "?").join(",")})
          ORDER BY position, created_at`,
    args: sectionIds,
  });
  return groupBySection(res.rows.map(parseResource));
}

/**
 * LEARNER VIEW of one resource.
 *
 * An uploaded file is shown inside ImpactOS, so the learner is handed a
 * SHORT-LIVED SIGNED URL instead of the permanent public link stored on the row,
 * and the storage path never leaves the server — the same rule the lessons
 * follow (see docs/LMS_ARCHITECTURE.md §10): what the learner is meant to watch
 * or open here must not become a link they can keep and pass on. External links
 * are the author's own and pass through untouched; the staff surfaces keep
 * reading the stored values, where handing over a link is acceptable.
 *
 * A file that cannot be signed comes back with `url: null`, so the surface can
 * say it is unavailable instead of rendering a dead link.
 */
async function toLearnerResource(resource) {
  if (!resource || resource.source !== "upload") return resource;
  const url = await signSectionResourcePath(resource.storage_path);
  return { ...resource, url, storage_path: null };
}

/**
 * The same grouping, seen by a LEARNER (uploaded files signed for the moment).
 * Keeping it a distinct read means a staff surface can never accidentally hand a
 * learner the permanent link, and a learner surface can never accidentally sign
 * for staff.
 */
export async function learnerSectionResourcesByCourse(courseId) {
  const grouped = await listSectionResourcesByCourse(courseId);
  const signed = new Map();
  for (const [sectionId, resources] of grouped) {
    signed.set(sectionId, await Promise.all(resources.map(toLearnerResource)));
  }
  return signed;
}

export async function createSectionResource({
  sectionId,
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
  if (!sectionId) throw new LmsError("lms.errors.sectionNotFound", 400);
  await assertSectionExists(sectionId);

  const position = await nextPosition("lms_section_resources", "section_id", String(sectionId));

  const recommended = isRecommended === true;
  const resolvedSource = normalizeSource(source);
  assertUploadMetadata(resolvedSource, url, storagePath);

  const res = await db.execute({
    sql: `INSERT INTO lms_section_resources
            (section_id, kind, title, description, url,
             source, storage_path, file_name, file_size, mime_type,
             is_recommended, recommendation_note, position, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [
      String(sectionId),
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

export async function updateSectionResource(resourceId, fields = {}) {
  const existing = await getSectionResource(resourceId);
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
    sql: `UPDATE lms_section_resources SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  const updated = await getSectionResource(resourceId);

  // Replacing an uploaded file leaves the previous object orphaned in storage:
  // drop it (best-effort — the row is already correct).
  if (
    existing.source === "upload" &&
    existing.storage_path &&
    String(existing.storage_path) !== String(updated.storage_path || "")
  ) {
    await removeSectionResourceFile(existing.storage_path);
  }
  return updated;
}

export async function deleteSectionResource(resourceId) {
  const existing = await getSectionResource(resourceId);
  if (!existing) throw new LmsError("lms.errors.resourceNotFound", 404);
  await db.execute({
    sql: "DELETE FROM lms_section_resources WHERE id = ?",
    args: [resourceId],
  });
  // The row is gone; the file should not outlive it (best-effort, never throws).
  if (existing.source === "upload" && existing.storage_path) {
    await removeSectionResourceFile(existing.storage_path);
  }
  return { success: true, id: resourceId };
}
