"use client";

import React, { use } from "react";
import { FacilitatorsPanel } from "@/components/pm/FacilitatorsPanel";

export const dynamic = "force-dynamic";

export default function ProgramFacilitatorsPage({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;

  return (
    <>
      <FacilitatorsPanel programId={id} />
    </>
  );
}
