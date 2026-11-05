"use client";

import MembershipScreen from "@/components/crm/MembershipScreen";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — organizational membership.
 *
 * The screen derives its own posture: the roster is read-only unless
 * `org_membership.manage` is held (Super Admin bypasses). Reading the roster
 * requires `org_membership.view`, which also makes this sub-section appear in
 * the sidebar.
 */
export default function CrmMembershipPage() {
  return <MembershipScreen />;
}
