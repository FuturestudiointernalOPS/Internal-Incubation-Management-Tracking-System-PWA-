"use client";

import React from "react";
import PortfolioOverview from "@/components/ventures/portfolio/PortfolioOverview";

/**
 * /admin/ventures/dashboard — the Super Admin's Portfolio overview.
 *
 * A thin wrapper: the read and all four widgets live in <PortfolioOverview>.
 * This route exists so the sidebar's DASHBOARD entry under VENTURES has an
 * address of its own.
 *
 * It is a deliberate sibling of the `[id]` segment rather than a child of it.
 * Next.js resolves a static segment before a dynamic one, so this never
 * collides with a single Venture's dashboard at
 * /admin/ventures/[id]/dashboard — the same arrangement that already lets
 * /admin/ventures/admin and /admin/ventures/projects coexist with [id].
 *
 * Nothing here writes, and no role is chosen on this page: the shell comes
 * from the section layout, and the API gate is the only authorisation.
 */
export default function VenturesDashboardPage() {
  return <PortfolioOverview />;
}
