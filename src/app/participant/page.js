"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useApi } from "@/lib/hooks/useApi";
import ParticipantDashboardHome from "@/components/dashboard/ParticipantDashboardHome";

export default function ParticipantDashboardPage() {
  const router = useRouter();
  const { user, role } = useSessionUser();
  const { data: relationships, loading } = useApi(user && role !== "investor" ? "/api/me/relationships" : null, { defaultValue: null });
  const investorAccount = role === "investor" || relationships?.isInvestor === true;

  useEffect(() => {
    if (investorAccount) router.replace("/investor/dashboard");
  }, [investorAccount, router]);

  if (!user || investorAccount || loading) return null;
  return <div className="p-6"><ParticipantDashboardHome /></div>;
}
