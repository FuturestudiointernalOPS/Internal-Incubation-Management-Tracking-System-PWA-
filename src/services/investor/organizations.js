/**
 * Investor service — the investor organizations.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — an organization is
 * visible only to its members (or management), the listing is scoped to the
 * caller's own profile, and only an administrator OF THAT organization (or
 * management) may add or re-role a member. Every statement lives in
 * `@/models/investorRelations`. No SQL, no HTTP: a refusal is a value
 * ({ ok: false, status, error }) the HTTP boundary turns into a response.
 */

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
import {
  resolveInvestorScope,
  isSameInvestor,
} from "@/models/authorization/investorScope";

/**
 * The organizations the caller may see: one organization detail (with its
 * members) when an id is given — 404 unless the caller is a member or manages —
 * or the list of organizations the caller belongs to.
 */
export async function listOrganizationsForViewer({ organizationId, session }) {
  if (organizationId) {
    // An organization is visible only to its members (or management).
    const scope = await resolveInvestorScope(session);
    const members = await listOrganizationMembers(organizationId);
    if (
      !scope.management &&
      !members.rows.some((member) => isSameInvestor(member.investor_id, scope.profileId))
    ) {
      return { ok: false, status: 404, error: "errors.notFound" };
    }

    const org = await getOrganizationById(organizationId);
    return { ok: true, organization: org.rows[0] || null, members: members.rows };
  }

  const profileResult = await getInvestorProfileIdForOrgList(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return { ok: true, organizations: [] };
  }

  const result = await listInvestorOrganizationsByMember(profileResult.rows[0].id);
  return { ok: true, organizations: result.rows };
}

/** Create an organization and enroll the caller as its admin. */
export async function createOrganization({ name, description, website, logoUrl, session }) {
  if (!name) return { ok: false, status: 400, error: "Organization name required" };

  const profileResult = await getInvestorProfileIdForOrgCreate(session.cid || session.id);
  if (profileResult.rows.length === 0) {
    return { ok: false, status: 404, error: "Investor profile not found" };
  }

  const organizationResult = await insertOrganization(
    name,
    description || null,
    website || null,
    logoUrl || null,
  );
  const org = organizationResult.rows[0];

  await addOrganizationAdmin(org.id, profileResult.rows[0].id);

  return { ok: true, organization: org };
}

/**
 * Add a member to an organization. Only an administrator of that organization
 * (or management) may do so — previously any investor could enroll any profile
 * into any organization with any role, including "admin".
 */
export async function addOrganizationMember({
  organizationId,
  investorProfileId,
  role,
  session,
}) {
  if (!organizationId || !investorProfileId) {
    return { ok: false, status: 400, error: "organization_id and investor_profile_id required" };
  }

  const scope = await resolveInvestorScope(session);
  if (!scope.management) {
    const members = await listOrganizationMembers(organizationId);
    const isOrgAdmin = members.rows.some(
      (member) =>
        isSameInvestor(member.investor_id, scope.profileId) && member.role === "admin",
    );
    if (!isOrgAdmin) {
      return { ok: false, status: 403, error: "errors.insufficientPermissions" };
    }
  }

  await upsertOrganizationMember(organizationId, investorProfileId, role || "member");
  return { ok: true };
}
