import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import {
  listOrganizationsForViewer,
  createOrganization,
  addOrganizationMember,
} from "@/services/investor";

/**
 * GET /api/investor/organizations
 * POST — create org and add current investor as admin
 * PUT — add member to org
 *
 * The member/organization scope and the admin-of-this-organization rule live in
 * `@/services/investor`.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("id");

    const result = await listOrganizationsForViewer({
      organizationId: orgId,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    if (result.members) {
      return NextResponse.json({
        success: true,
        organization: result.organization,
        members: result.members,
      });
    }

    return NextResponse.json({ success: true, organizations: result.organizations });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { name, description, website, logo_url } = await req.json();

    const result = await createOrganization({
      name,
      description,
      website,
      logoUrl: logo_url,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, organization: result.organization });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("edit");
    if (capError) return capError;

    const { organization_id, investor_profile_id, role } = await req.json();

    const result = await addOrganizationMember({
      organizationId: organization_id,
      investorProfileId: investor_profile_id,
      role,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
