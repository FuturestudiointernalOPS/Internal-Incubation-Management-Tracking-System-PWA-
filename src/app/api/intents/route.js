import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import {
  createIntentForSession,
  deleteIntentForSession,
  listIntentsForSession,
  updateIntentForSession,
} from "@/services/platform/intents";

/**
 * INTENTS API — Phase 4
 *
 * An Intent is a higher-level objective with tasks, blockers,
 * responsible person, and Contact Group scoping.
 *
 * GET    /api/intents?context_type=staff&context_id=X&status=active&responsible_id=X
 * POST   /api/intents  { title, description, responsible_id, context_type, ... }
 * PUT    /api/intents  { id, title, ... }
 * DELETE /api/intents?id=X
 *
 * Thin controller: the decisions (visibility, responsible-exists, ownership,
 * the update field set) live in `services/platform/intents`.
 */

/** GET — List intents filtered by context, status, responsible person. */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const result = await listIntentsForSession({
      session,
      filters: {
        contextType: searchParams.get("context_type"),
        contextId: searchParams.get("context_id"),
        responsibleId: searchParams.get("responsible_id"),
        status: searchParams.get("status"),
        projectId: searchParams.get("project_id"),
      },
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("GET intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/** POST — Create a new Intent. */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const result = await createIntentForSession({ session, input: body });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/** PUT — Update an existing Intent. */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const result = await updateIntentForSession({ session, input: body });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("PUT intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/** DELETE — Delete an Intent and unlink its tasks. */
export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const result = await deleteIntentForSession({
      session,
      id: searchParams.get("id"),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("DELETE intents error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
