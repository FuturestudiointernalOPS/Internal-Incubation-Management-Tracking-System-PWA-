"use client";

import React, { use } from "react";
import PersonRecordScreen from "@/components/crm/PersonRecordScreen";

export const dynamic = "force-dynamic";

/**
 * The administration door to the person record. The screen itself is shared
 * with the CRM workspace (`/crm/people/[cid]`) so the same person is one
 * dossier, never two.
 */
export default function CrmDetailPage({ params }) {
  const { cid } = use(params);
  return <PersonRecordScreen cid={cid} basePath="/admin/crm" />;
}
