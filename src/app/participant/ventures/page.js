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

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{t("venture.myVentures")}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("venture.title")}</p>
          </div>
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
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/participant/ventures/${venture.venture_id || venture.id}`)}
                onKeyDown={(event) => {
                  // A clickable card must also open from the keyboard.
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/participant/ventures/${venture.venture_id || venture.id}`);
                  }
                }}
                className="rounded-xl p-5 transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]"
                style={{
                  backgroundColor: "var(--surface-3)",
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)"
                }}
                onMouseEnter={event => { event.currentTarget.style.borderColor = "var(--brand-orange)"; event.currentTarget.style.boxShadow = "0 4px 20px rgb(255 102 0 / 0.15)"; }}
                onMouseLeave={event => { event.currentTarget.style.borderColor = "var(--border-primary)"; event.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="flex items-start justify-between mb-3">
                  {/* Same display rule as every other Ventures surface: the
                      company name first, the legacy `name` column only as a
                      fallback (it can still hold a pre-fix intake-run label). */}
                  <h3 className="font-semibold text-lg">{venture.company_name || venture.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: venture.status === "active" ? "rgb(16 185 129 / 0.2)" : venture.status === "paused" ? "rgb(245 158 11 / 0.2)" : venture.status === "graduated" ? "rgb(168 85 247 / 0.2)" : "var(--border-primary)",
                      color: venture.status === "active" ? "var(--chart-success)" : venture.status === "paused" ? "var(--chart-warning)" : venture.status === "graduated" ? "var(--chart-info)" : "var(--text-secondary)"
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
