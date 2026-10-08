import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmContactOrganizationById,
  updateCrmContactOrganization,
  deleteCrmContactOrganization,
} from "@/models/crm/relationships";

export const dynamic = "force-dynamic";

/**
 * Single CRM Contact-Organization relationship
 *
 * PATCH  /api/crm/contacts/[cid]/organizations/[rid]  — update relationship fields (crm.edit)
 * DELETE /api/crm/contacts/[cid]/organizations/[rid]  — remove the link (crm.delete)
 *
 * Note: DELETE here is a hard delete of the LINK, not of the contact or the org.
 * The contact and the organization both remain untouched.
 */

export const PATCH = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { rid } = await params;
    const body = await req.json();

    const check = await getCrmContactOrganizationById(rid);
    if (!check.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.relationships.notFound" },
        { status: 404 },
      );
    }

    const result = await updateCrmContactOrganization(rid, {
      relationship_type: body.relationship_type,
      title:             body.title,
      is_primary:        body.is_primary,
      is_current:        body.is_current,
      started_at:        body.started_at,
      ended_at:          body.ended_at,
      notes:             body.notes,
    });

    return NextResponse.json({
      success: true,
      relationship: result.rows?.[0] ?? null,
    });
  },
);

export const DELETE = createHandler(
  { roles: ["super_admin", "staff"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { rid } = await params;

    const result = await deleteCrmContactOrganization(rid);

    if (!result.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.relationships.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
