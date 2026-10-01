/**
 * Platform — the Collections CRUD (SERVICE layer).
 *
 * The domain work behind `/api/platform/collections`: the list + recursive
 * tree assembly, the create's slug and parent-reference guard, the update and
 * the audit trail. The CONTROLLER keeps `initDb`, the session/role gate and the
 * response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import {
  archivePlatformCollection,
  createPlatformCollection,
  createPlatformCollectionAuditLog,
  getPlatformCollectionById,
  getPlatformCollectionForUpdate,
  getPlatformCollectionParentById,
  listPlatformCollections,
  updatePlatformCollection,
} from "@/models/forms";

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

function logAudit(collectionId, action, actorId, actorName, details = {}) {
  createPlatformCollectionAuditLog({
    collection_id: collectionId,
    action,
    actor_id: actorId,
    actor_name: actorName,
    details,
  }).catch(() => {}); // fire-and-forget
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function getCollection(id) {
  const result = await getPlatformCollectionById(id);
  if (result.rows.length === 0) {
    return { status: 404, body: { success: false, error: "errors.notFound" } };
  }
  return { status: 200, body: { success: true, collection: result.rows[0] } };
}

/** List collections with filters, plus the recursively nested tree. */
export async function listCollections({ parentId, status, ownerId, search }) {
  const result = await listPlatformCollections({ parentId, status, ownerId, search });

  // Build tree: recursively nest children at any depth
  const all = result.rows;
  const buildTree = (nodeParentId) => {
    const nodes = all.filter((collection) =>
      nodeParentId === null ? !collection.parent_id : collection.parent_id === nodeParentId
    );
    return nodes.map((node) => ({
      ...node,
      children: buildTree(node.id),
    }));
  };
  const tree = buildTree(null);

  return { status: 200, body: { success: true, collections: all, tree } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function createCollection({ body, session }) {
  const { name, description, parent_id, owner_id, owner_name, visibility, tags, category, color } = body;

  if (!name || !name.trim()) {
    return { status: 400, body: { success: false, error: "Name is required" } };
  }

  const slug = slugify(name) + "-" + Date.now().toString(36);

  // Validate parent exists and prevent circular references
  if (parent_id) {
    const parent = await getPlatformCollectionParentById(parent_id);
    if (parent.rows.length === 0) {
      return { status: 400, body: { success: false, error: "Parent collection not found" } };
    }
  }

  const result = await createPlatformCollection({
    name,
    slug,
    description,
    parent_id,
    owner_id,
    owner_name,
    visibility,
    tags,
    category,
    color,
    created_by: session.cid,
  });

  logAudit(result.rows[0].id, "created", session.cid, owner_name || session.cid);

  return { status: 200, body: { success: true, collection: result.rows[0] } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function updateCollection({ body, session }) {
  const { id, name, description, parent_id, owner_id, owner_name, visibility, tags, category, status, color } = body;

  if (!id) {
    return { status: 400, body: { success: false, error: "ID is required" } };
  }

  const existing = await getPlatformCollectionForUpdate(id);
  if (existing.rows.length === 0) {
    return { status: 404, body: { success: false, error: "errors.notFound" } };
  }

  const result = await updatePlatformCollection({
    id,
    name,
    description,
    parent_id,
    owner_id,
    owner_name,
    visibility,
    tags,
    category,
    status,
    color,
  });

  logAudit(id, "updated", session.cid, owner_name || session.cid, {
    name,
    description,
    parent_id,
    owner_id,
    owner_name,
    visibility,
    tags,
    category,
    status,
    color,
  });

  return { status: 200, body: { success: true, collection: result.rows[0] } };
}

/** Soft delete (archive). @returns {Promise<{status: number, body: Object}>} */
export async function archiveCollection({ id, session }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "ID is required" } };
  }

  // Soft delete: archive
  const result = await archivePlatformCollection(id);

  if (result.rows.length === 0) {
    return { status: 404, body: { success: false, error: "errors.notFound" } };
  }

  logAudit(id, "archived", session.cid, session.cid);

  return { status: 200, body: { success: true, collection: result.rows[0] } };
}
