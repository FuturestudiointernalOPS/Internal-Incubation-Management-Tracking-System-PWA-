"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import VentureStatusBadge from "@/components/ventures/VentureStatusBadge";

/**
 * Ventures -> Project Management : choose the Venture.
 *
 * The list is `GET /api/ventures`, which ALREADY answers the only hard question
 * here — which Ventures may this person see? A Super Admin gets the directory, a
 * delegated Venture Manager gets the Ventures they are assigned to, and a member
 * gets their own. Re-asking it here would be a second, weaker authority.
 *
 * Read-only (Phase 1): choosing a Venture opens its work items; nothing on this
 * screen writes.
 */
export default function ProjectsLandingPage() {
  const { t } = useI18n();
  const { data, loading, error } = useApi("/api/ventures", { defaultValue: null });

  const ventures = data?.ventures || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-[var(--brand-orange)]" />
          {t("venture.projects.title")}
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{t("venture.projects.subtitle")}</p>
      </div>

      {error ? (
        <AppEmptyState title={t("venture.projects.loadFailed")} description={error} />
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
      ) : ventures.length === 0 ? (
        <AppEmptyState
          title={t("venture.projects.noVentures")}
          description={t("venture.projects.noVenturesHint")}
          icon={FolderKanban}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {ventures.map((venture) => (
            <Link key={venture.venture_id} href={`/admin/ventures/projects/${venture.venture_id}`}>
              <AppCard hover className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--text-primary)] break-words">
                      {venture.company_name || venture.name || venture.venture_id}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{venture.venture_id}</p>
                    {venture.industry && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">{venture.industry}</p>
                    )}
                  </div>
                  <VentureStatusBadge status={venture.status} />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] mt-3">
                  {t("venture.projects.open")} <ArrowRight className="w-3 h-3" />
                </div>
              </AppCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
