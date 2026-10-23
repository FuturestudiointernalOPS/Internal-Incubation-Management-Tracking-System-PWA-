"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Route } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import PageHero from "@/components/ui/PageHero";
import ProjectsWorkItemsView from "@/components/ventures/projects/ProjectsWorkItemsView";
import VenturePeoplePanel from "@/components/ventures/projects/VenturePeoplePanel";
import VentureTimelineView from "@/components/ventures/timeline/VentureTimelineView";

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);

/**
 * Admin → Ventures → [Venture] → Projects ("Project" button of the Venture header)
 *
 * The Venture's work — milestones, activities, deliverables — and its Timeline
 * (Gantt, progress, delays, roadmap), as two views of the same page.
 * The Journey itself (stages, templates, change history) is edited on the
 * `/journey` page, reached from the hub's "Journey" tab.
 */
export default function VentureProjectsPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const view = searchParams?.get("view") === "timeline" ? "timeline" : "work";
  const selectView = (next) => {
    const query = new URLSearchParams(searchParams?.toString?.() || "");
    if (next === "work") query.delete("view");
    else query.set("view", next);
    const suffix = query.toString();
    router.replace(`/admin/ventures/${id}/projects${suffix ? `?${suffix}` : ""}`, { scroll: false });
  };

  const { data: venture } = useApi(id ? `/api/ventures/${id}` : null, {
    defaultValue: null,
    transform: pickVenture,
    deps: [id],
  });

  const name = venture?.company_name || t("vadmin.dashboard.venture");

  return (
    <div className="pb-20">

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

      <div className="flex gap-2 mb-5" role="tablist">
        {["work", "timeline"].map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => selectView(option)}
            className={`stf-btn ${view === option ? "pr" : ""}`}
          >
            {t(option === "work" ? "venture.projects.viewWork" : "venture.projects.viewTimeline")}
          </button>
        ))}
      </div>

      {id && view === "timeline" && <VentureTimelineView id={id} embedded />}

      {id && view === "work" && <ProjectsWorkItemsView ventureId={id} emailsHref={`/admin/ventures/${id}/projects/emails`} />}

      {id && view === "work" && (
        <div className="pt-2">
          <VenturePeoplePanel ventureId={id} />
        </div>
      )}
    </div>
  );
}
