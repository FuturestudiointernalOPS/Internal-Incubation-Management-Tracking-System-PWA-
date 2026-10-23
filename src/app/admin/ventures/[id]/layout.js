"use client";

import React from "react";
import VentureHubNav from "@/components/admin/ventures/VentureHubNav";

/**
 * Every page of a Venture in the Super Admin area shares ONE navigation bar —
 * the Venture's name, its tabs, Project and Staff. It lives here, in the layout,
 * so it stays put as you move around and no page needs its own "back to…" link.
 */
export default function AdminVentureLayout({ children, params }) {
  const { id } = React.use(params);
  return (
    <div className="pb-20">
      <VentureHubNav id={id} />
      {children}
    </div>
  );
}
