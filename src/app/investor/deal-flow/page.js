"use client";

import { useState } from "react";
import { Loader2, Plus, Star } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "@/components/ui/AppButton";

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
    } catch (_) {
    } finally {
      setBusy(null);
    }
  };

  const addPipeline = async (ventureId) => {
    setBusy(ventureId);
    try {
      await post("/api/investor/pipeline", { venture_id: ventureId, stage: "interested" });
      refresh();
    } catch (_) {
    } finally {
      setBusy(null);
    }
  };

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("investorMisc.dealFlow.title")}</h1>
          <p className="stf-sub">{t("investorMisc.dealFlow.subtitle")}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="stf-small">{t("investorMisc.dealFlow.empty")}</p>
      ) : (
        <div className="stf-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {entries.map((entry) => (
            <div key={entry.id} className="stf-card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div>
                  <b>{entry.name}</b>
                  <div className="stf-small">
                    {entry.industry || "—"} · {entry.country || "—"}
                  </div>
                </div>
                {entry.deck && <span className="stf-tag g">{t("investorMisc.dealFlow.deckAvailable")}</span>}
              </div>

              <p className="stf-small">{entry.description || "—"}</p>
              <div className="stf-small" style={{ fontWeight: 700 }}>
                {entry.raise_amount} {entry.currency}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={Star}
                  onClick={() => addWatchlist(entry.id)}
                  disabled={busy === entry.id}
                >
                  {t("investorMisc.dealFlow.watchlist")}
                </AppButton>
                <AppButton
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => addPipeline(entry.id)}
                  disabled={busy === entry.id}
                >
                  {t("investorMisc.dealFlow.addPipeline")}
                </AppButton>
                {entry.deck && (
                  <a className="stf-btn" href={`/investor/deck/${entry.deck.id}`}>
                    {t("investorMisc.dealFlow.openDeck")}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
