"use client";

import React from "react";
import { useParams } from "next/navigation";
import VentureDashboard from "@/components/ventures/VentureDashboard";

/**
 * /admin/ventures/[id]/dashboard — standalone full Venture dashboard.
 *
 * Every Venture sub-page (milestones, tasks, sessions, …) and several deep
 * links navigate here via "Back to Dashboard", so this route stays as a thin
 * wrapper around the shared <VentureDashboard>, which the Venture hub page
 * (/admin/ventures/[id]) also embeds on its Dashboard tab (the first view when
 * an admin opens a Venture).
 */
export default function VentureDashboardPage() {
  const { id } = useParams();
  return <VentureDashboard id={id} />;
}
