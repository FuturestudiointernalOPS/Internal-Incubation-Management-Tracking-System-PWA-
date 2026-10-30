"use client";

import React, { use } from "react";
import PersonRecordScreen from "@/components/crm/PersonRecordScreen";

export const dynamic = "force-dynamic";

/**
 * The CRM workspace door to the person record.
 *
 * Same screen, same dossier, same rights as the administration route — the
 * difference is only the back links. Opening the person from People, from a
 * lead, from an opportunity or from an organization all land here.
 */
export default function CrmPersonRecordPage({ params }) {
  const { cid } = use(params);
  return <PersonRecordScreen cid={cid} basePath="/crm" />;
}
