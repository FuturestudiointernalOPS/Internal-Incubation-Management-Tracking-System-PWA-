"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Plus,
  Search,
  ChevronRight,
  Users,
  Clock,
  TrendingUp,
  Loader2,
  ExternalLink,
  Link2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const VENTURE_STAGES = {
  idea: { label: "vadmin.list.stageIdea", color: "text-blue-400 bg-blue-500/10" },
  validation: { label: "vadmin.list.stageValidation", color: "text-purple-400 bg-purple-500/10" },
  early_traction: { label: "vadmin.list.stageEarlyTraction", color: "text-amber-400 bg-amber-500/10" },
  growth: { label: "vadmin.list.stageGrowth", color: "text-emerald-400 bg-emerald-500/10" },
  scaling: { label: "vadmin.list.stageScaling", color: "text-[var(--brand-orange)] bg-[var(--brand-orange)]/10" },
};

const STATUS_CONFIG = {
  active: { label: "vadmin.list.statusActive", color: "text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-400" },
  pending: { label: "vadmin.list.statusPending", color: "text-amber-400 bg-amber-500/10", dot: "bg-amber-400" },
  archived: { label: "vadmin.list.statusArchived", color: "text-slate-400 bg-slate-500/10", dot: "bg-slate-400" },
};

export default function VenturesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [ventures, setVentures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchVentures();
  }, []);

  const fetchVentures = async (bypassCache = false) => {
    setLoading(true);
    try {
      const url = "/api/ventures";
      const apply = (data) => {
        if (data.success) setVentures(data.ventures || []);
      };
      // Cache-first paint: returning to this page renders instantly from a fresh
      // snapshot; mutation flows pass bypassCache=true so the list always
      // reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (e) {
      console.error("Failed to fetch ventures:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredVentures = ventures.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.company_name?.toLowerCase().includes(q) ||
      v.venture_id?.toLowerCase().includes(q) ||
      v.industry?.toLowerCase().includes(q)
    );
  });

  const stageConfig = (stage) => VENTURE_STAGES[stage] || VENTURE_STAGES.idea;
  const statusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.active;

  const approveVenture = async (venture) => {
    try {
      const res = await fetch(`/api/ventures/${venture.venture_id}/approve`, { method: "POST" });
      const d = await res.json();
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: {
            type: d.success ? "success" : "error",
            message: d.success ? t("vadmin.list.approveSuccess") : (t((d.error || t("vadmin.list.approveFailed")) || "") || (d.error || t("vadmin.list.approveFailed"))),
            duration: 4000,
          },
        })
      );
      if (d.success) fetchVentures(true);
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("vadmin.list.approveFailed"), duration: 4000 },
        })
      );
    }
  };

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("vadmin.list.ventureOs")}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-3">
              <Rocket className="w-8 h-8 text-[var(--brand-orange)]" />
              {t("vadmin.list.title")}
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                try {
                  const email = window.prompt(t("vadmin.list.inviteEmailPrompt"));
                  if (!email) return;
                  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
                    window.dispatchEvent(
                      new CustomEvent("impactos:notify", {
                        detail: {
                          type: "error",
                          message: t("vadmin.list.inviteEmailInvalid"),
                          duration: 4000,
                        },
                      })
                    );
                    return;
                  }
                  const res = await fetch("/api/platform/venture-invitations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: email.trim(), source_type: "external" }),
                  });
                  const d = await res.json();
                  if (d.success && d.run?.url) {
                    await navigator.clipboard.writeText(d.run.url);
                    window.dispatchEvent(
                      new CustomEvent("impactos:notify", {
                        detail: {
                          type: "success",
                          message: t("vadmin.list.inviteCopied"),
                          duration: 4000,
                        },
                      })
                    );
                  } else {
                    window.dispatchEvent(
                      new CustomEvent("impactos:notify", {
                        detail: {
                          type: "error",
                          message: d.error || t("vadmin.list.inviteFailed"),
                          duration: 5000,
                        },
                      })
                    );
                  }
                } catch (e) {
                  window.dispatchEvent(
                    new CustomEvent("impactos:notify", {
                      detail: {
                        type: "error",
                        message: t("vadmin.list.inviteFailed"),
                        duration: 5000,
                      },
                    })
                  );
                }
              }}
              className="btn gap-2"
            >
              <Link2 className="w-4 h-4" /> {t("vadmin.list.copyInviteLink")}
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/platform/venture-run");
                  const d = await res.json();
                  if (d.success && d.url) {
                    window.open(d.url, "_blank", "noopener,noreferrer");
                  } else {
                    window.dispatchEvent(
                      new CustomEvent("impactos:notify", {
                        detail: {
                          type: "error",
                          message: d.error || t("vadmin.list.noActiveVentureForm"),
                          duration: 5000,
                        },
                      })
                    );
                  }
                } catch (e) {
                  window.dispatchEvent(
                    new CustomEvent("impactos:notify", {
                      detail: {
                        type: "error",
                        message: t("vadmin.list.noActiveVentureForm"),
                        duration: 5000,
                      },
                    })
                  );
                }
              }}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> {t("vadmin.list.openVentureForm")}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={t("vadmin.list.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:border-[var(--brand-orange)]/50 transition-all"
          />
        </div>

        {/* Ventures Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : filteredVentures.length === 0 ? (
          <div className="text-center py-20">
            <Rocket className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              {searchQuery ? t("vadmin.list.noSearchResults") : t("vadmin.list.noVentures")}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {searchQuery
                ? t("vadmin.list.tryDifferentSearch")
                : t("vadmin.list.noVenturesDesc")}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push("/admin/ventures/register")}
                className="btn btn-primary gap-2"
              >
                <Plus className="w-4 h-4" /> {t("vadmin.list.registerStartup")}
              </button>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <th className="text-left px-5 py-3">{t("vadmin.list.venture")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.industry")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.stage")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.status")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.members")}</th>
                    <th className="text-left px-5 py-3">{t("vadmin.list.created")}</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredVentures.map((venture) => {
                    const stage = stageConfig(venture.business_stage);
                    const status = statusConfig(venture.status);
                    const founderCount = parseInt(venture.founder_count) || 0;
                    const memberCount = parseInt(venture.member_count) || 0;
                    return (
                      <tr
                        key={venture.id}
                        onClick={() => router.push(`/admin/ventures/${venture.venture_id}`)}
                        className="border-b border-[var(--border-primary)]/50 cursor-pointer hover:bg-tertiary/50 transition-all group"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                              <Rocket className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--text-primary)]">{venture.company_name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{venture.venture_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-slate-500/10 text-slate-400">
                            {venture.industry}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${stage.color}`}>
                            {t(stage.label)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-2 py-1 rounded ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot || "bg-current"}`} />
                            {t(status.label)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-slate-400 font-medium">
                          {t("vadmin.list.membersCount", { count: founderCount + memberCount })}
                        </td>
                        <td className="px-5 py-3 text-[11px] text-slate-400 font-medium">
                          {new Date(venture.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {venture.status === "pending" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); approveVenture(venture); }}
                              className="mr-3 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                            >
                              {t("vadmin.list.approve")}
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-600 inline group-hover:text-[var(--brand-orange)] transition-colors" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
