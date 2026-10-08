"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";
import ProjectsWorkItemsView from "@/components/ventures/projects/ProjectsWorkItemsView";
import VentureRemindersPanel from "@/components/ventures/projects/VentureRemindersPanel";

/**
 * Ventures -> Project Management -> one Venture (Phase 1, read-only).
 *
 * The screen's only job is to frame the work: which Venture, and a way back.
 * Everything about WHAT is shown — the work items, their buckets, their filter
 * options — belongs to the service and is rendered by
 * `ProjectsWorkItemsView`.
 */
export default function ProjectWorkItemsPage() {
  const { t } = useI18n();
  const params = useParams();
  const ventureId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  // The Venture's own record: the work-items read deliberately returns work, not
  // the Venture's name, so the header asks the Venture endpoint for it.
  const { data, loading } = useApi(ventureId ? `/api/ventures/${ventureId}` : null, {
    deps: [ventureId],
    defaultValue: null,
  });

  const venture = data?.venture || data?.data || data;
  const ventureName = venture?.company_name || venture?.name || ventureId;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/ventures/projects"
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] hover:text-[var(--brand-orange)] transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> {t("venture.projects.title")}
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <h1 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[var(--brand-orange)]" />
            {loading ? <Skeleton className="h-6 w-48" /> : ventureName}
          </h1>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-tertiary)]">
            {t("venture.projects.readOnly")}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{t("venture.projects.subtitle")}</p>
      </div>

      {ventureId && <ProjectsWorkItemsView ventureId={ventureId} />}

      {ventureId && (
        <div className="pt-2">
          <VentureRemindersPanel ventureId={ventureId} />
        </div>
      )}
    </div>
  );
}
