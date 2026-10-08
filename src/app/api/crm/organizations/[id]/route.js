import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmOrganizationById,
  updateCrmOrganization,
  softDeleteCrmOrganization,
} from "@/models/crm/organizations";
import { getCrmOrganizationContacts } from "@/models/crm/relationships";

export const dynamic = "force-dynamic";

/**
 * CRM Organization — single record
 *
 * GET    /api/crm/organizations/[id]   — fetch org + its people (crm.view)
 * PATCH  /api/crm/organizations/[id]  — update mutable fields (crm.edit)
 * DELETE /api/crm/organizations/[id]  — soft-delete (crm.delete)
 */

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { id } = await params;

    const [orgResult, contactsResult] = await Promise.all([
      getCrmOrganizationById(id),
      getCrmOrganizationContacts(id),
    ]);

    const org = orgResult.rows?.[0] ?? null;
    if (!org) {
      return NextResponse.json(
        { success: false, error: "crm.organizations.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      organization: org,
      contacts: contactsResult.rows,
    });
  },
);

export const PATCH = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "edit");
    if (authError) return authError;

    const { id } = await params;
    const body = await req.json();

    // Validate org exists before attempting update
    const check = await getCrmOrganizationById(id);
    if (!check.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.organizations.notFound" },
        { status: 404 },
      );
    }

    const result = await updateCrmOrganization(id, {
      name:        body.name,
      type:        body.type,
      website:     body.website,
      industry:    body.industry,
      description: body.description,
      owner_cid:   body.owner_cid,
    });

    return NextResponse.json({
      success: true,
      organization: result.rows?.[0] ?? null,
    });
  },
);

export const DELETE = createHandler(
  { roles: ["super_admin"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "delete");
    if (authError) return authError;

    const { id } = await params;
    const session = await getSession();

    const result = await softDeleteCrmOrganization(id, session?.user?.cid ?? null);

    if (!result.rows?.[0]) {
      return NextResponse.json(
        { success: false, error: "crm.organizations.notFound" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
