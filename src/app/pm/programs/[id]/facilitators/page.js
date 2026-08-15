"use client";

import React, { use } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { FacilitatorsPanel } from "@/components/pm/FacilitatorsPanel";

export const dynamic = "force-dynamic";

export default function ProgramFacilitatorsPage({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;

  return (
    <DashboardLayout role="program_manager" activeTab="v2">
      <FacilitatorsPanel programId={id} />
    </DashboardLayout>
  );
}
