"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useApi } from "@/lib/hooks/useApi";
import { carriesContextualValue } from "@/lib/identity";
import { Rocket, GraduationCap } from "lucide-react";
import ParticipantDashboardHome from "@/components/dashboard/ParticipantDashboardHome";
import FounderDashboardOverview from "@/components/dashboard/FounderDashboardOverview";

const EMPTY_LIST = [];
const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);

export default function ParticipantDashboardPage() {
  const router = useRouter();
  const { user, role, cid } = useSessionUser();

  // 1. Fetch user relationships to detect investor, founder, or learner contexts
  const { data: relationships, loading: relLoading } = useApi(
    user && !carriesContextualValue(role, "investor") ? "/api/me/relationships" : null,
    { defaultValue: null }
  );

  // 2. Fetch user's ventures
  const { data: ventures, loading: venturesLoading } = useApi(
    cid ? `/api/ventures?contact_id=${cid}` : null,
    { defaultValue: EMPTY_LIST, transform: pickVentures, deps: [cid] }
  );

  const investorAccount = carriesContextualValue(role, "investor") || relationships?.isInvestor === true;

  // Determine user contexts
  const isFounder = Boolean(relationships?.isFounder || ventures.length > 0);
  const isLearner = Boolean(relationships?.isProgramParticipant);

  // Active view tab state: null initially, derived gracefully
  const [selectedTab, setSelectedTab] = useState(null);
  const activeTab = selectedTab || (isFounder ? "ventures" : "learning");

  useEffect(() => {
    if (investorAccount) {
      router.replace("/investor/dashboard");
    }
  }, [investorAccount, router]);

  if (!user || investorAccount || relLoading) return null;

  const showContextSwitcher = isFounder && isLearner;

  return (
    <div className="p-6 space-y-6">
      {/* ── Context Switcher (Only visible for dual-context users: Founder + Learner) ── */}
      {showContextSwitcher && (
        <div className="flex items-center gap-2 p-1 rounded-xl bg-surface-2 border border-[var(--border-primary)] w-fit">
          <button
            type="button"
            onClick={() => setSelectedTab("ventures")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "ventures"
                ? "bg-[var(--brand-orange)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Rocket size={14} />
            My Ventures ({ventures.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("learning")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "learning"
                ? "bg-[var(--brand-orange)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <GraduationCap size={15} />
            Cohorts & Learning
          </button>
        </div>
      )}

      {/* ── View Render ── */}
      {isFounder && activeTab === "ventures" ? (
        <FounderDashboardOverview
          ventures={ventures}
          loading={venturesLoading}
          userName={user.name || "Founder"}
        />
      ) : (
        <ParticipantDashboardHome />
      )}
    </div>
  );
}
