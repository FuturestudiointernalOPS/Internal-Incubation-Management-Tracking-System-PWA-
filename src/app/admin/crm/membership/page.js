"use client";

import MembershipScreen from "@/components/crm/MembershipScreen";

/**
 * Admin route for organizational membership. The screen itself lives in
 * src/components/crm/MembershipScreen.js and is shared with the non-admin CRM
 * workspace (/crm/membership) — the admin side gets the write affordances.
 */
export default function MembershipPage() {
  return <MembershipScreen />;
}
