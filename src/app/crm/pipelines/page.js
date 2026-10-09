"use client";

import React, { useEffect, useState } from "react";
import { Settings, ChevronRight } from "lucide-react";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * CRM Pipelines configuration page — /crm/pipelines
 * Visible to authorized users. Editing requires crm.manage (super_admin).
 * Shows all pipelines with their stages for review.
 */
export default function CrmPipelinesPage() {
  const { t } = useI18n();
  const [pipelines, setPipelines] = useState([]);
  const [expanded, setExpanded]   = useState({});
  const [stages, setStages]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/crm/pipelines?include_inactive=true");
        const data = await res.json();
        if (data.success) setPipelines(data.pipelines ?? []);
        else setError(t(data.error || "errors.somethingWrong"));
      } catch {
        setError(t("errors.somethingWrong"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function togglePipeline(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
    if (!stages[id]) {
      const res  = await fetch(`/api/crm/pipelines/${id}`);
      const data = await res.json();
      if (data.success) {
        setStages((s) => ({ ...s, [id]: data.stages ?? [] }));
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-[var(--brand-orange)]" />
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {t("crm.pipelines.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {t("crm.pipelines.subtitle")}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : pipelines.length === 0 ? (
        <AppEmptyState icon={Settings} title={t("crm.pipelines.noPipelines")} />
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <div key={p.id} className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
              <button
                onClick={() => togglePipeline(p.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-3)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                  {!p.is_active && (
                    <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                      {t("crm.pipelines.inactive")}
                    </span>
                  )}
                  {p.description && (
                    <span className="text-sm text-[var(--text-secondary)]">{p.description}</span>
                  )}
                </div>
                <ChevronRight className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${expanded[p.id] ? "rotate-90" : ""}`} />
              </button>

              {expanded[p.id] && (
                <div className="border-t border-[var(--border-primary)] px-5 py-4">
                  {stages[p.id] ? (
                    <ol className="flex flex-wrap gap-2">
                      {stages[p.id].map((s) => (
                        <li key={s.id} className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold
                            ${s.is_terminal
                              ? s.outcome === "won"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                              : "bg-[var(--surface-3)] text-[var(--text-primary)]"}`}>
                            {s.position}. {s.name}
                          </span>
                          {s.probability > 0 && (
                            <span className="text-xs text-[var(--text-secondary)]">{s.probability}%</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Skeleton className="h-6 w-full" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
