"use client";

import { useParams } from "next/navigation";
import VentureReportingScreen from "@/components/ventures/reporting/VentureReportingScreen";

export default function FounderVentureWorkspace() {
  const params = useParams();
  return <VentureReportingScreen ventureId={params.id} />;
}
