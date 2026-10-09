import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmContactOrganizations,
  createCrmContactOrganization,
} from "@/models/crm/relationships";

export const dynamic = "force-dynamic";

/**
 * CRM Contact-Organization Relationships
 *
 * GET  /api/crm/contacts/[cid]/organizations
 *      — list all orgs this contact is linked to (crm.view)
 *
 * POST /api/crm/contacts/[cid]/organizations
 *      — link this contact to an existing CRM organization (crm.create)
 *      Body: { organization_id, relationship_type?, title?, is_primary?, started_at?, notes? }
 *
 * This does NOT create the organization — use POST /api/crm/organizations first,
 * then link with this endpoint.
 */

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (_req, { params }) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { cid } = await params;
    const result = await getCrmContactOrganizations(cid);

    return NextResponse.json({
      success: true,
      organizations: result.rows,
    });
  },
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req, { params }) => {
    const authError = await requireAuthorization("crm", "create");
    if (authError) return authError;

    const { cid } = await params;
    const session = await getSession();
    const body = await req.json();

    const organization_id = body.organization_id ?? null;
    if (!organization_id) {
      return NextResponse.json(
        { success: false, error: "crm.relationships.organizationRequired" },
        { status: 400 },
      );
    }

    const result = await createCrmContactOrganization({
      contact_cid:       cid,
      organization_id,
      relationship_type: body.relationship_type ?? "works_for",
      title:             body.title ?? null,
      is_primary:        body.is_primary ?? false,
      started_at:        body.started_at ?? null,
      notes:             body.notes ?? null,
      created_by:        session?.user?.cid ?? null,
    });

    const relationship = result.rows?.[0] ?? null;

    // ON CONFLICT DO NOTHING returns no row — relationship already existed
    if (!relationship) {
      return NextResponse.json(
        { success: false, error: "crm.relationships.alreadyExists" },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, relationship }, { status: 201 });
  },
);
