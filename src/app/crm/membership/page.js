"use client";

import MembershipScreen from "@/components/crm/MembershipScreen";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — organizational membership (read-only).
 *
 * Same screen as the admin route, without any write affordance: editing
 * memberships requires `org_membership.manage` (PUT /api/org-membership) and
 * belongs to Super Admin. Reading the roster requires `org_membership.view`,
 * which is also the capability that makes this sub-section appear in the
 * sidebar (NAV_CAPABILITY_REQUIREMENTS.crm_membership).
 */
export default function CrmMembershipPage() {
  return <MembershipScreen readOnly />;
}
