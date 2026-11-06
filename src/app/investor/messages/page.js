"use client";

import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import PageHero from "@/components/ui/PageHero";
import { Skeleton } from "@/components/ui/Skeleton";
import InvestorMobileNav from "@/components/investor/dashboard-page/InvestorMobileNav";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const pickWorkspaces = (payload) =>
  payload?.success && Array.isArray(payload.workspaces) ? payload.workspaces : [];

/**
 * Investor messages hub (Guide Phase 4 entry point).
 * Lists relationship workspaces; conversation lives at /investor/messages/[id].
 */
export default function InvestorMessagesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: workspaces, loading } = useApi("/api/investor/relationships", {
    defaultValue: [],
    transform: pickWorkspaces,
  });

  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-24 sm:p-6 md:pb-6">
        <PageHero
          kicker={t("dashboardV2.kicker")}
          title={t("dashboardV2.nav.messages")}
          subtitle={t("dashboardV2.messagesEmptyHint")}
        />

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : workspaces.length === 0 ? (
          <AppEmptyState
            icon={MessageSquare}
            title={t("dashboardV2.messagesEmpty")}
            description={t("dashboardV2.messagesEmptyHint")}
            action={
              <AppButton variant="secondary" onClick={() => router.push("/investor/dashboard")}>
                {t("dashboardV2.nav.dashboard")}
              </AppButton>
            }
          />
        ) : (
          <ul className="space-y-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/investor/messages/${encodeURIComponent(workspace.id)}`)}
                  className="stf-card flex min-h-11 w-full items-center justify-between gap-3 text-left"
                >
                  <span>
                    <span className="block font-bold text-[var(--text-primary)]">
                      {workspace.venture_name || workspace.id}
                    </span>
                    <span className="stf-small">
                      {workspace.status || t("dashboardV2.openConversation")}
                    </span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wide text-[var(--brand-orange)]">
                    {t("dashboardV2.openConversation")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <InvestorMobileNav messagingEnabled />
    </>
  );
}
