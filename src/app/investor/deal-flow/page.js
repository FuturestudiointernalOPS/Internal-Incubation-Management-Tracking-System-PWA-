"use client";

import { useState } from "react";
import { ArrowRight, Building2, FileText, Loader2, Plus, Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import PageHero from "@/components/ui/PageHero";
import SectionHead from "@/components/ui/SectionHead";

const pickEntries = (payload) => (payload?.success ? payload.entries || [] : []);
const EMPTY = [];

/**
 * /investor/deal-flow
 *
 * The investor's live deal flow, DTO-shaped by the API. In deal-flow-only mode
 * this is the whole discoverable set; in full-pipeline mode the dashboard
 * additionally lists the studio directory.
 */
export default function InvestorDealFlowPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { alert } = useDialogs();
  const { data: entries, loading, refresh } = useApi("/api/investor/deal-flow", {
    defaultValue: EMPTY,
    transform: pickEntries,
  });
  const [busy, setBusy] = useState(null);

  const post = async (url, body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!json.success) throw new Error(json.error || "Failed");
  };

  const addWatchlist = async (ventureId) => {
    setBusy(ventureId);
    try {
      await post("/api/investor/watchlist", { venture_id: ventureId });
      refresh();
      await alert({ message: t("investorMisc.dealFlow.watchlistAdded") });
    } catch (error) {
      await alert({ message: error.message || t("investorMisc.dealFlow.actionFailed") });
    } finally {
      setBusy(null);
    }
  };

  const addPipeline = async (ventureId) => {
    setBusy(ventureId);
    try {
      await post("/api/investor/pipeline", { venture_id: ventureId, stage: "interested" });
      refresh();
      await alert({ message: t("investorMisc.dealFlow.pipelineAdded") });
    } catch (error) {
      await alert({ message: error.message || t("investorMisc.dealFlow.actionFailed") });
    } finally {
      setBusy(null);
    }
  };

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" role="status" aria-label={t("investorMisc.dealFlow.loading")} />
      </div>
    );
  }

  return (
    <div className="stf mx-auto max-w-7xl space-y-6 p-4 pb-16 sm:p-6">
      <PageHero
        kicker={t("investorMisc.dealFlow.kicker")}
        title={t("investorMisc.dealFlow.title")}
        subtitle={t("investorMisc.dealFlow.subtitle")}
        action={
          <AppButton variant="secondary" icon={ArrowRight} onClick={() => router.push("/investor/dashboard")}>
            {t("investorMisc.dealFlow.backToDashboard")}
          </AppButton>
        }
      />

      {entries.length === 0 ? (
        <AppEmptyState
          title={t("investorMisc.dealFlow.emptyTitle")}
          description={t("investorMisc.dealFlow.empty")}
          icon={Building2}
          size="lg"
          action={
            <AppButton variant="secondary" onClick={() => router.push("/investor/dashboard")}>
              {t("investorMisc.dealFlow.discoverVentures")}
            </AppButton>
          }
        />
      ) : (
        <>
          <SectionHead
            letter="D"
            tone="o"
            icon={Building2}
            title={t("investorMisc.dealFlow.liveVentures")}
            subtitle={t("investorMisc.dealFlow.ventureCount", { count: entries.length })}
          />
          <div className="stf-grid c3">
            {entries.map((entry) => (
              <article key={entry.id} className="stf-card flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">{entry.name}</h2>
                    <p className="stf-small mt-1">
                      {[entry.industry, entry.country].filter(Boolean).join(" · ") || t("investorMisc.dealFlow.ventureDetailsPending")}
                    </p>
                  </div>
                  {entry.deck && <span className="stf-tag g shrink-0">{t("investorMisc.dealFlow.deckAvailable")}</span>}
                </div>

                <p className="min-h-12 text-sm leading-6 text-[var(--text-secondary)]">
                  {entry.description || t("investorMisc.dealFlow.noDescription")}
                </p>

                {entry.raise_amount && (
                  <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)] p-3">
                    <p className="stf-k">{t("investorMisc.dealFlow.fundraisingTarget")}</p>
                    <p className="mt-1 text-base font-extrabold tabular-nums text-[var(--text-primary)]">
                      {entry.raise_amount} {entry.currency}
                    </p>
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border-primary)] pt-4">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={Star}
                    onClick={() => addWatchlist(entry.id)}
                    disabled={busy !== null}
                  >
                    {t("investorMisc.dealFlow.watchlist")}
                  </AppButton>
                  <AppButton
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => addPipeline(entry.id)}
                    disabled={busy !== null}
                  >
                    {t("investorMisc.dealFlow.addPipeline")}
                  </AppButton>
                  {entry.deck && (
                    <a className="stf-btn" href={`/investor/deck/${entry.deck.id}`}>
                      <FileText size={14} aria-hidden="true" />
                      {t("investorMisc.dealFlow.openDeck")}
                    </a>
                  )}
                  {busy === entry.id && <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-orange)]" aria-label={t("investorMisc.dealFlow.saving")} />}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
