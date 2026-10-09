import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getCrmOrganizations,
  searchCrmOrganizations,
  createCrmOrganization,
} from "@/models/crm/organizations";

export const dynamic = "force-dynamic";

/**
 * CRM Organizations API
 *
 * GET  /api/crm/organizations            — list all CRM organizations (crm.view)
 * GET  /api/crm/organizations?q=…        — search by name fragment
 * POST /api/crm/organizations            — create a new CRM organization (crm.create)
 *
 * Thin controller: authorization + request shaping only.
 * All SQL lives in @/models/crm/organizations.
 */

export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "view");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const ownerCid = searchParams.get("owner_cid") ?? undefined;

    let result;
    if (q.length > 0) {
      result = await searchCrmOrganizations(q, 30);
    } else {
      result = await getCrmOrganizations({ ownerCid });
    }

    return NextResponse.json({
      success: true,
      organizations: result.rows,
    });
  },
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const authError = await requireAuthorization("crm", "create");
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();

    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "crm.organizations.nameRequired" },
        { status: 400 },
      );
    }

    const result = await createCrmOrganization({
      name,
      type:        body.type ?? null,
      website:     body.website ?? null,
      industry:    body.industry ?? null,
      description: body.description ?? null,
      owner_cid:   body.owner_cid ?? session?.user?.cid ?? null,
      created_by:  session?.user?.cid ?? null,
    });

    const org = result.rows?.[0] ?? null;
    return NextResponse.json({ success: true, organization: org }, { status: 201 });
  },
);
