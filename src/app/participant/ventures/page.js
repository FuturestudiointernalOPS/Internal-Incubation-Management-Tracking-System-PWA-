"use client";

import { useState, useEffect } from "react";
import { Briefcase, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export default function ParticipantVentures() {
  const [user, setUser] = useState({});
  const [ventures, setVentures] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  useEffect(() => {
    if (!user.cid) return;
    loadVentures();
  }, [user]);

  async function loadVentures(bypassCache = false) {
    const url = `/api/ventures?contact_id=${user.cid}`;
    const apply = (data) => {
      if (data.success) setVentures(data.ventures);
    };
    try {
      // Cache-first paint: returning to this page renders instantly from a
      // fresh snapshot; creating a venture passes bypassCache=true so the
      // list always reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (e) {
      console.error("Failed to load ventures", e);
    } finally {
      setLoading(false);
    }
  }

  // Phase 2 pipeline: Venture creation goes through the Venture Application
  // Form/Run. This button opens the configured Venture Run.
  async function openVentureApplication() {
    try {
      const res = await fetch("/api/platform/venture-run");
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "error", message: t("venture.loadError"), duration: 4000 },
          })
        );
      }
    } catch (e) {
      console.error("Failed to resolve Venture Run", e);
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
            {ventures.map((v) => (
              <div
                key={v.id}
                onClick={() => router.push(`/participant/ventures/${v.venture_id || v.id}`)}
                className="rounded-xl p-5 transition-all cursor-pointer border"
                style={{
                  backgroundColor: "rgb(255 255 255 / 0.05)",
                  borderColor: "rgb(255 255 255 / 0.1)",
                  color: "var(--text-primary)"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand-orange)"; e.currentTarget.style.boxShadow = "0 4px 20px rgb(255 102 0 / 0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgb(255 255 255 / 0.1)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-lg">{v.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{
                      backgroundColor: v.status === "active" ? "rgb(16 185 129 / 0.2)" : v.status === "paused" ? "rgb(245 158 11 / 0.2)" : v.status === "graduated" ? "rgb(168 85 247 / 0.2)" : "rgb(255 255 255 / 0.1)",
                      color: v.status === "active" ? "#10b981" : v.status === "paused" ? "#f59e0b" : v.status === "graduated" ? "#a855f7" : "var(--text-secondary)"
                    }}
                  >
                    {t(`venture.statuses.${v.status || "active"}`)}
                  </span>
                </div>
                {v.description && (
                  <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{v.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>{t(`venture.stages.${v.business_stage || "idea"}`)}</span>
                  <span>•</span>
                  <span>{v.founder_count || 0} {t("venture.founderCount")}</span>
                  {v.industry && (
                    <>
                      <span>•</span>
                      <span>{v.industry}</span>
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
