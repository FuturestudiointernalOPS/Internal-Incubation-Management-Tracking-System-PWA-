import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  archiveCollection,
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
} from "@/services/platform/collections";

/**
 * PLATFORM COLLECTIONS API — CRUD operations
 *
 * GET    /api/platform/collections              — List all collections
 * GET    /api/platform/collections?id=X          — Get one collection
 * GET    /api/platform/collections?parent_id=X   — Get children of a collection
 * POST   /api/platform/collections               — Create collection
 * PUT    /api/platform/collections               — Update collection
 * DELETE /api/platform/collections?id=X          — Archive (soft delete)
 *
 * Thin controller: gates the role and delegates to
 * `@/services/platform/collections` (see docs/LAYER_SPLIT.md).
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // Single collection
    if (id) {
      const { status, body } = await getCollection(id);
      return NextResponse.json(body, { status });
    }

    // List with filters
    const { body } = await listCollections({
      parentId: searchParams.get("parent_id"),
      status: searchParams.get("status"),
      search: searchParams.get("search"),
      ownerId: searchParams.get("owner_id"),
    });
    return NextResponse.json(body);
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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();
    const { status, body: responseBody } = await createCollection({ body, session });
    return NextResponse.json(responseBody, { status });
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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();
    const { status, body: responseBody } = await updateCollection({ body, session });
    return NextResponse.json(responseBody, { status });
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

    const { status, body } = await archiveCollection({ id, session });
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
