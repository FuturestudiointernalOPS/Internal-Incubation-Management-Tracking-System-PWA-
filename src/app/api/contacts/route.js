import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { normalizeGroupName, INTERNAL_GROUP } from "@/lib/authorization/membership";
import {
  createContacts,
  updateContact,
  listContacts,
  deleteContact,
} from "@/services/contacts";

export const dynamic = "force-dynamic";

/**
 * CONTACTS API — PERSONNEL REGISTRY
 * Hardened for Gated Onboarding and Real-time Alerts.
 * Decisions live in `@/services/contacts`; this file is auth + response shape.
 */

export async function POST(req) {
  try {
    await initDb();
    // Auth is optional — public forms create contacts without login.
    const session = await getSession();
    if (session) {
      const capError = await requireAuthorization("contacts", "create");
      if (capError) return capError;
    }

    const assignRoleError = await requireAuthorization(
      "permissions",
      "assign_capabilities",
    );
    const canAssignRole = Boolean(session) && !assignRoleError;

    const body = await req.json();
    const contacts = Array.isArray(body) ? body : [body];

    const wantsInternal = contacts.some(
      (contact) => normalizeGroupName(contact?.group_name) === INTERNAL_GROUP,
    );
    if (wantsInternal) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const result = await createContacts({ contacts, session, canAssignRole });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("CRITICAL CONTACTS ERROR:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "edit");
    if (capError) return capError;

    const data = await req.json();

    if (normalizeGroupName(data?.group_name) === INTERNAL_GROUP) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const assignRoleError = await requireAuthorization(
      "permissions",
      "assign_capabilities",
    );
    const canAssignRole = !assignRoleError;
    const session = await getSession();

    const result = await updateContact({ data, canAssignRole, session });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const roleFilter = searchParams.get("role");
    const groupFilter = searchParams.get("group");
    const cidFilter = searchParams.get("cid");

    const capError = await requireAuthorization("contacts", "view");
    const canReadDirectory = !capError;

    const result = await listContacts({
      session,
      canReadDirectory,
      statusFilter,
      roleFilter,
      groupFilter,
      cidFilter,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE — Soft-delete a contact (never physically deletes).
 */
export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "delete");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "Contact ID (cid) is required." },
        { status: 400 },
      );
    }

    const session = await getSession();
    const deletedBy =
      session?.name || session?.email || session?.cid || "unknown";

    const result = await deleteContact({ cid, deletedBy });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
