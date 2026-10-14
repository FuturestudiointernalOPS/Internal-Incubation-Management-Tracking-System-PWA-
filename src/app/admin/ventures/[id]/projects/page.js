"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Route } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import PageHero from "@/components/ui/PageHero";
import ProjectsWorkItemsView from "@/components/ventures/projects/ProjectsWorkItemsView";

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);

/**
 * Admin → Ventures → [Venture] → Projects ("Project" button of the Venture header)
 *
 * The Venture's work — milestones, activities, deliverables — and nothing else.
 * The Journey itself (stages, templates, change history) is edited on the
 * `/journey` page, reached from the hub's "Journey" tab.
 */
export default function VentureProjectsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const { t } = useI18n();

  const { data: venture } = useApi(id ? `/api/ventures/${id}` : null, {
    defaultValue: null,
    transform: pickVenture,
    deps: [id],
  });

  const name = venture?.company_name || t("vadmin.dashboard.venture");

  return (
    <div className="pb-20">
      <button
        onClick={() => router.push(`/admin/ventures/${id}`)}
        className="flex items-center gap-2 mb-5 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> {t("venture.projects.backToVenture", { name })}
      </button>

      <PageHero
        kicker={venture?.venture_id || id}
        title={t("venture.projects.pageTitle")}
        subtitle={t("venture.projects.pageSubtitle", { company: name, code: venture?.venture_id || id })}
        action={
          <button type="button" className="stf-btn" onClick={() => router.push(`/admin/ventures/${id}/journey`)}>
            <Route size={14} /> {t("vadmin.journey.title")}
          </button>
        }
      />

      {id && <ProjectsWorkItemsView ventureId={id} />}
    </div>
  );
}
