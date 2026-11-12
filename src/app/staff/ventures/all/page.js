"use client";

import VenturesDirectory from "@/spaces/staff/core/components/VenturesDirectory";

/**
 * Staff → Ventures → All Ventures.
 *
 * The server decides the perimeter (`ventures.view_all`): a staff member
 * without it receives only their assigned Ventures, and the sidebar does not
 * offer this door. A member never reaches the staff section at all.
 */
export default function StaffAllVenturesPage() {
  return <VenturesDirectory />;
}
