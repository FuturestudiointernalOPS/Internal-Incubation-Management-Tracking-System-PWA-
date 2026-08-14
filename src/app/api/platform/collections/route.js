import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * PLATFORM COLLECTIONS API — CRUD operations
 *
 * GET    /api/platform/collections              — List all collections
 * GET    /api/platform/collections?id=X          — Get one collection
 * GET    /api/platform/collections?parent_id=X   — Get children of a collection
 * POST   /api/platform/collections               — Create collection
 * PUT    /api/platform/collections               — Update collection
 * DELETE /api/platform/collections?id=X          — Archive (soft delete)
 */

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
  db.execute({
    sql: `INSERT INTO platform_collection_audit (collection_id, action, actor_id, actor_name, details)
          VALUES (?, ?, ?, ?, ?)`,
    args: [collectionId, action, actorId || null, actorName || null, JSON.stringify(details)],
  }).catch(() => {}); // fire-and-forget
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin", "staff"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const parentId = searchParams.get("parent_id");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const ownerId = searchParams.get("owner_id");

    // Single collection
    if (id) {
      const result = await db.execute({
        sql: "SELECT * FROM platform_collections WHERE id = ?",
        args: [parseInt(id)],
      });
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
      return NextResponse.json({ success: true, collection: result.rows[0] });
    }

    // List with filters
    let sql = "SELECT * FROM platform_collections WHERE 1=1";
    const args = [];

    if (parentId) {
      sql += " AND parent_id = ?";
      args.push(parseInt(parentId));
    }
    if (status && status !== "all") {
      sql += " AND status = ?";
      args.push(status);
    }
    if (ownerId) {
      sql += " AND owner_id = ?";
      args.push(ownerId);
    }
    if (search) {
      sql += " AND (name ILIKE ? OR description ILIKE ?)";
      args.push(`%${search}%`, `%${search}%`);
    }
    sql += " ORDER BY name ASC";

    const result = await db.execute({ sql, args });

    // Build tree: recursively nest children at any depth
    const all = result.rows;
    const buildTree = (parentId) => {
      const nodes = all.filter((c) => (parentId === null ? !c.parent_id : c.parent_id === parentId));
      return nodes.map((node) => ({
        ...node,
        children: buildTree(node.id),
      }));
    };
    const tree = buildTree(null);

    return NextResponse.json({ success: true, collections: all, tree });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { name, description, parent_id, owner_id, owner_name, visibility, tags, category, color } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    const slug = slugify(name) + "-" + Date.now().toString(36);

    // Validate parent exists and prevent circular references
    if (parent_id) {
      const parent = await db.execute({
        sql: "SELECT id, parent_id FROM platform_collections WHERE id = ?",
        args: [parseInt(parent_id)],
      });
      if (parent.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Parent collection not found" }, { status: 400 });
      }
    }

    const result = await db.execute({
      sql: `INSERT INTO platform_collections
            (name, slug, description, parent_id, owner_id, owner_name, visibility, tags, category, color, created_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            RETURNING *`,
      args: [
        name.trim(),
        slug,
        description || null,
        parent_id ? parseInt(parent_id) : null,
        owner_id || null,
        owner_name || null,
        visibility || "internal",
        tags || [],
        category || null,
        color || "#FF6600",
        session.cid || null,
      ],
    });

    logAudit(result.rows[0].id, "created", session.cid, owner_name || session.cid);

    return NextResponse.json({ success: true, collection: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { id, name, description, parent_id, owner_id, owner_name, visibility, tags, category, status, color } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    const existing = await db.execute({
      sql: "SELECT * FROM platform_collections WHERE id = ?",
      args: [parseInt(id)],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    // Build update fields
    const fields = [];
    const args = [];
    const updatable = { name, description, parent_id, owner_id, owner_name, visibility, tags, category, status, color };

    for (const [key, value] of Object.entries(updatable)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === "parent_id") {
          args.push(value ? parseInt(value) : null);
        } else {
          args.push(value);
        }
      }
    }
    fields.push("updated_at = NOW()");
    args.push(parseInt(id));

    const result = await db.execute({
      sql: `UPDATE platform_collections SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
      args,
    });

    logAudit(id, "updated", session.cid, owner_name || session.cid, { ...updatable });

    return NextResponse.json({ success: true, collection: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    // Soft delete: archive
    const result = await db.execute({
      sql: `UPDATE platform_collections SET status = 'archived', updated_at = NOW() WHERE id = ? RETURNING *`,
      args: [parseInt(id)],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }

    logAudit(id, "archived", session.cid, session.cid);

    return NextResponse.json({ success: true, collection: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
