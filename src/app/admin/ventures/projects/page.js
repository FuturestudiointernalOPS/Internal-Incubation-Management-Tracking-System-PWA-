"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderKanban, Trash2 } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
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
 * The directory it answers with no longer contains DELETED Ventures: the listing
 * excludes archived ones server-side, so a Venture that was removed is not
 * offered as a project to open.
 *
 * The one write on this screen is the Administrator's "Delete All Project
 * History". Its button appears only when the SERVER says this session may do it
 * (the preview endpoint answers 403 for anyone else), and the deletion itself is
 * gated again on the same capability — hiding the button is a courtesy, not the
 * control.
 */
const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);
const pickPreview = (payload) => (payload?.success ? payload : null);

export default function ProjectsLandingPage() {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();
  const [clearing, setClearing] = useState(false);
  const { data, loading, error, refresh } = useApi("/api/ventures", {
    defaultValue: null,
    transform: pickVentures,
  });
  // Ask the server who may purge, and how much there is to purge. A refusal
  // (403) answers `null`, which is what keeps the button off the screen.
  const { data: preview, refresh: refreshPreview } = useApi("/api/admin/ventures/project-history", {
    defaultValue: null,
    transform: pickPreview,
  });

  const ventures = data || [];
  const mayClearHistory = Boolean(preview);

  const clearProjectHistory = async () => {
    const confirmed = await confirm({
      title: t("venture.projects.deleteHistoryTitle"),
      message: t("venture.projects.deleteHistoryMessage"),
      hint: t("venture.projects.deleteHistoryHint"),
      confirmLabel: t("venture.projects.deleteHistoryConfirm"),
      tone: "danger",
    });
    if (!confirmed) return;

    setClearing(true);
    try {
      const response = await fetch("/api/admin/ventures/project-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        await alert({ message: t(payload.error || "errors.somethingWrong"), tone: "danger" });
        return;
      }
      await alert({
        message: t("venture.projects.deleteHistoryDone", { count: payload.removed ?? 0 }),
      });
      // The screen must not keep showing work that no longer exists.
      refresh();
      refreshPreview();
    } catch (_) {
      await alert({ message: t("errors.somethingWrong"), tone: "danger" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[var(--brand-orange)]" />
            {t("venture.projects.title")}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{t("venture.projects.subtitle")}</p>
        </div>
        {mayClearHistory && (
          <AppButton
            variant="ghost"
            icon={Trash2}
            loading={clearing}
            onClick={clearProjectHistory}
            title={t("venture.projects.deleteHistory")}
          >
            {t("venture.projects.deleteHistory")}
          </AppButton>
        )}
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
