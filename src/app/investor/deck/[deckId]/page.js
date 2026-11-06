"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

const pickDeck = (payload) =>
  payload?.success ? { deck: payload.deck, watermark: payload.watermark } : null;

/**
 * /investor/deck/[deckId]
 *
 * View-only deck with a per-viewer watermark (investor id + date). Downloads are
 * disabled unless the studio enabled them for this deck. The server records
 * `deck_opened` on load and `deck_closed` with seconds on leave.
 */
export default function InvestorDeckPage() {
  const { t } = useI18n();
  const { deckId } = useParams();
  const openedAt = useRef(Date.now());
  const { data, loading } = useApi(`/api/investor/deck/${deckId}`, {
    defaultValue: null,
    transform: pickDeck,
  });

  useEffect(() => {
    openedAt.current = Date.now();
    const sendClosed = () => {
      const seconds = Math.round((Date.now() - openedAt.current) / 1000);
      const body = JSON.stringify({ seconds });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/investor/deck/${deckId}`,
          new Blob([body], { type: "application/json" }),
        );
      } else {
        void fetch(`/api/investor/deck/${deckId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", sendClosed);
    return () => {
      window.removeEventListener("pagehide", sendClosed);
      sendClosed();
    };
  }, [deckId]);

  if (loading && !data) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  if (!data?.deck?.file_ref) {
    return <p className="stf-small">{t("investorMisc.deck.unavailable")}</p>;
  }

  const stampedOn = data.watermark?.at ? new Date(data.watermark.at).toLocaleDateString() : "";
  const stamp = `${t("investorMisc.deck.viewOnly")} · #${data.watermark?.investor_id || ""} · ${stampedOn}`;

  return (
    <div className="stf" style={{ paddingBottom: 40 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("investorMisc.deck.viewOnly")}</h1>
        </div>
      </div>

      <div
        className="stf-card"
        style={{ position: "relative", overflow: "hidden", height: "75vh", padding: 0 }}
      >
        <iframe
          src={`${data.deck.file_ref}#toolbar=0&navpanes=0`}
          title={t("investorMisc.deck.viewOnly")}
          style={{ width: "100%", height: "100%", border: 0 }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 40,
            padding: 24,
            opacity: 0.12,
            transform: "rotate(-20deg)",
            fontWeight: 800,
            fontSize: 14,
            alignItems: "center",
            justifyItems: "center",
          }}
        >
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index}>{stamp}</span>
          ))}
        </div>
      </div>

      {!data.deck.download_allowed && (
        <p className="stf-small" style={{ marginTop: 8 }}>
          {t("investorMisc.deck.downloadDisabled")}
        </p>
      )}
    </div>
  );
}
