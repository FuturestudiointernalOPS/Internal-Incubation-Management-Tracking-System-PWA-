"use client";

import { ChevronRight, Loader2, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

/**
 * DATA BANK DOCUMENTS — pick the Venture first.
 *
 * The document list belongs to ONE Venture, so this door opens on the Ventures
 * this person may configure: every Venture for a Super Admin, and the Ventures
 * they lead for a Lead Manager (the `lead_manager` responsibility — the same
 * rule the server applies to the write).
 */

// Module-scope readers: the reading hook keys its internal work on them.
const pickAllVentures = (payload) => (payload?.success ? payload.ventures || [] : []);
const pickLedVentures = (payload) =>
  payload?.success
    ? (payload.assignments || []).filter(
        (assignment) => assignment.responsibility_code === "lead_manager",
      )
    : [];

export default function VentureDocumentTypePicker({ scope = "admin", backHref = "/admin/ventures" }) {
  const { t } = useI18n();
  const router = useRouter();
  const isAdmin = scope === "admin";
  const basePath = isAdmin ? "/admin/ventures" : "/staff/ventures";

  const { data: ventures, loading, error, status } = useApi(
    isAdmin ? "/api/ventures" : "/api/ventures/assigned",
    { defaultValue: [], transform: isAdmin ? pickAllVentures : pickLedVentures },
  );

  const loadError = error || (status && status >= 400 ? t("venture.documentTypes.errorLoadFailed") : null);
  const list = ventures || [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <AppCard padding="lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
                {t("venture.documentTypes.pickTitle")}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t("venture.documentTypes.pickSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(backHref)}
            className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            {t("common.back")}
          </button>
        </div>
      </AppCard>

      {loading && list.length === 0 && (
        <AppCard>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </AppCard>
      )}

      {loadError && (
        <AppCard>
          <p className="text-xs text-rose-500">{loadError}</p>
        </AppCard>
      )}

      {!loading && !loadError && list.length === 0 && (
        <AppCard>
          <AppEmptyState
            title={t(isAdmin ? "venture.documentTypes.pickEmpty" : "venture.documentTypes.pickEmptyLead")}
            description={t(
              isAdmin
                ? "venture.documentTypes.pickEmptyDescription"
                : "venture.documentTypes.pickEmptyLeadDescription",
            )}
            icon={Rocket}
          />
        </AppCard>
      )}

      <div className="space-y-3">
        {list.map((venture) => (
          <AppCard
            key={venture.venture_id}
            hover
            onClick={() => router.push(`${basePath}/${venture.venture_id}/document-types`)}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--text-primary)] truncate">
                  {venture.company_name || venture.name || venture.venture_id}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                  {venture.venture_id}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            </div>
          </AppCard>
        ))}
      </div>

      {loading && list.length > 0 && (
        <div className="flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
        </div>
      )}
    </div>
  );
}
