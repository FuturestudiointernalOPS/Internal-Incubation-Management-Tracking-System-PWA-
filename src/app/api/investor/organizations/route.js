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
import { resolveInvestorScope, isSameInvestor } from "@/models/authorization/investorScope";

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
      // Own-scope: an organization is visible only to its members (or management).
      const scope = await resolveInvestorScope(session);
      const members = await listOrganizationMembers(orgId);
      if (!scope.management && !members.rows.some((member) => isSameInvestor(member.investor_id, scope.profileId))) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
      const org = await getOrganizationById(orgId);
      return NextResponse.json({
        success: true,
        organization: org.rows[0] || null,
        members: members.rows,
      });
    }

    // List orgs the current investor belongs to
    const profileResult = await getInvestorProfileIdForOrgList(user.cid || user.id);

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ success: true, organizations: [] });
    }

    const result = await listInvestorOrganizationsByMember(profileResult.rows[0].id);

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

    const profileResult = await getInvestorProfileIdForOrgCreate(user.cid || user.id);
    if (profileResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found" }, { status: 404 });
    }

    const investorId = profileResult.rows[0].id;

    // Create org
    const organizationResult = await insertOrganization(name, description || null, website || null, logo_url || null);

    const org = organizationResult.rows[0];

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

    // Own-scope: only an administrator OF THAT organization (or management) may
    // add or re-role a member — previously any investor could enroll any profile
    // into any organization with any role, including "admin".
    const session = await getSession();
    const scope = await resolveInvestorScope(session);
    if (!scope.management) {
      const members = await listOrganizationMembers(organization_id);
      const isOrgAdmin = members.rows.some(
        (member) => isSameInvestor(member.investor_id, scope.profileId) && member.role === "admin",
      );
      if (!isOrgAdmin) {
        return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 });
      }
    }

    await upsertOrganizationMember(organization_id, investor_profile_id, role || "member");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
