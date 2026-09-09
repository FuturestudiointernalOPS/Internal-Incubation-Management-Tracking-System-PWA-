import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import {
  addOrganizationAdmin,
  getInvestorProfileIdForOrgCreate,
  getInvestorProfileIdForOrgList,
  getOrganizationById,
  insertOrganization,
  listInvestorOrganizationsByMember,
  listOrganizationMembers,
  upsertOrganizationMember,
} from "@/models/investorRelations";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/** GET /api/investor/organizations */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const session = await getSession();
    const user = session;
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("id");

    if (orgId) {
      const org = await getOrganizationById(orgId);
      const members = await listOrganizationMembers(orgId);
      return NextResponse.json({
        success: true,
        organization: org.rows[0] || null,
        members: members.rows,
      });
    }

    // List orgs the current investor belongs to
    const profile = await getInvestorProfileIdForOrgList(user.cid || user.id);

    if (profile.rows.length === 0) {
      return NextResponse.json({ success: true, organizations: [] });
    }

    const result = await listInvestorOrganizationsByMember(profile.rows[0].id);

    return NextResponse.json({ success: true, organizations: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/organizations — create org and add current investor as admin */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const session = await getSession();
    const user = session;
    const { name, description, website, logo_url } = await req.json();

    if (!name) {
      return NextResponse.json({ success: false, error: "Organization name required" }, { status: 400 });
    }

    const profile = await getInvestorProfileIdForOrgCreate(user.cid || user.id);
    if (profile.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found" }, { status: 404 });
    }

    const investorId = profile.rows[0].id;

    // Create org
    const orgRes = await insertOrganization(name, description || null, website || null, logo_url || null);

    const org = orgRes.rows[0];

    // Add creator as admin
    await addOrganizationAdmin(org.id, investorId);

    return NextResponse.json({ success: true, organization: org });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PUT /api/investor/organizations — add member to org */
export async function PUT(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("edit");
    if (capError) return capError;

    const { organization_id, investor_profile_id, role } = await req.json();

    if (!organization_id || !investor_profile_id) {
      return NextResponse.json({ success: false, error: "organization_id and investor_profile_id required" }, { status: 400 });
    }

    await upsertOrganizationMember(organization_id, investor_profile_id, role || "member");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
