"use client";

import { Briefcase, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);

export default function ParticipantVentures() {
  const { t } = useI18n();
  const router = useRouter();

  // Scoping is resolved server-side from the session; the contact identifier in
  // the address only narrows the list for a global role. It comes from the
  // shell's session cache rather than from the browser's stored copy, so no
  // effect has to read a browser store. The identity is absent for the first
  // moment of a cold load, and the screen keeps its placeholder until it
  // arrives rather than asking for a list it would have to ask for again.
  const { cid } = useSessionUser();
  const { data: ventures, loading: readLoading } = useApi(
    cid ? `/api/ventures?contact_id=${cid}` : null,
    { defaultValue: EMPTY_LIST, transform: pickVentures, deps: [cid] },
  );
  const loading = !cid || readLoading;

  // Phase 2 pipeline: Venture creation goes through the Venture Application
  // Form/Run. This button opens the configured Venture Run.
  async function openVentureApplication() {
    try {
      const response = await fetch("/api/platform/venture-run");
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "error", message: t("venture.loadError"), duration: 4000 },
          })
        );
      }
    } catch (error) {
      console.error("Failed to resolve Venture Run", error);
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("venture.loadError"), duration: 4000 },
        })
      );
    }
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{t("venture.myVentures")}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.title")}</p>
          </div>
          <button
            onClick={openVentureApplication}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-white"
            style={{ backgroundColor: "var(--brand-orange)" }}
          >
            <Briefcase size={18} />
            {t("venture.applyAsVenture")}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" style={{ color: "var(--text-secondary)" }} size={32} />
          </div>
        ) : ventures.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--text-secondary)" }}>
            <Briefcase size={48} className="mx-auto mb-4 opacity-40" />
            <p>{t("venture.noVentures")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ventures.map((venture) => (
              <div
                key={venture.id}
                onClick={() => router.push(`/participant/ventures/${venture.venture_id || venture.id}`)}
                className="rounded-xl p-5 transition-all cursor-pointer border"
                style={{
                  backgroundColor: "rgb(255 255 255 / 0.05)",
                  borderColor: "rgb(255 255 255 / 0.1)",
                  color: "var(--text-primary)"
                }}
                onMouseEnter={event => { event.currentTarget.style.borderColor = "var(--brand-orange)"; event.currentTarget.style.boxShadow = "0 4px 20px rgb(255 102 0 / 0.15)"; }}
                onMouseLeave={event => { event.currentTarget.style.borderColor = "rgb(255 255 255 / 0.1)"; event.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="flex items-start justify-between mb-3">
                  {/* Same display rule as every other Ventures surface: the
                      company name first, the legacy `name` column only as a
                      fallback (it can still hold a pre-fix intake-run label). */}
                  <h3 className="font-semibold text-lg">{venture.company_name || venture.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: venture.status === "active" ? "rgb(16 185 129 / 0.2)" : venture.status === "paused" ? "rgb(245 158 11 / 0.2)" : venture.status === "graduated" ? "rgb(168 85 247 / 0.2)" : "rgb(255 255 255 / 0.1)",
                      color: venture.status === "active" ? "#10b981" : venture.status === "paused" ? "#f59e0b" : venture.status === "graduated" ? "#a855f7" : "var(--text-secondary)"
                    }}
                  >
                    {t(`venture.statuses.${venture.status || "active"}`)}
                  </span>
                </div>
                {venture.description && (
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{venture.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{t(`venture.stages.${venture.business_stage || "idea"}`)}</span>
                  <span>•</span>
                  <span>{venture.founder_count || 0} {t("venture.founderCount")}</span>
                  {venture.industry && (
                    <>
                      <span>•</span>
                      <span>{venture.industry}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
