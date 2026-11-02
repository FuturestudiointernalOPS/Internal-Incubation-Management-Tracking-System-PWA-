"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  ArrowRight,
  Building2,
  Calendar,
  Layers,
  Sparkles,

} from "lucide-react";
import AppTable from "@/components/ui/AppTable";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import PageHero from "@/components/ui/PageHero";
import KpiCard from "@/components/ui/KpiCard";
import ParticipantCommandCalendar from "@/components/ui/ParticipantCommandCalendar";
import CreateActions from "@/components/create/CreateActions";
import StartupBroadcastBanner from "@/components/ventures/StartupBroadcastBanner";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

const pickHome = (response) => (response?.success ? response : null);
const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);

/**
 * FounderExecutiveDashboard
 *
 * Dedicated executive command center for startup founders (/founder).
 * Benchmark: YC Bookface / Techstars Orbit.
 *
 * Components:
 * 1. Executive Page Hero (Welcome, Venture Manager reference, Add Company action)
 * 2. 4 Startup Executive KPIs (Meetings/Sessions, Deliverables Due, Milestones, Readiness)
 * 3. 60 / 40 Split Horizon Grid:
 *    - Left (60%): Interactive Founder Calendar (Sessions, office hours, syncs)
 *    - Right (40%): Active Venture Spotlight & Sprints (Deliverables, workspace launcher)
 * 4. Startup Portfolio Table (if founder owns multiple companies)
 */
export default function FounderExecutiveDashboard() {
  const router = useRouter();
  const { user, cid } = useSessionUser();

  // 1. Fetch user ventures
  const { data: ventures = [], loading: venturesLoading } = useApi(
    cid ? `/api/ventures?contact_id=${cid}` : null,
    { defaultValue: [], transform: pickVentures, deps: [cid] },
  );

  // 2. Fetch personal command home (for calendar events & sessions)
  const { data: homeData, loading: homeLoading } = useApi("/api/participant/home", {
    defaultValue: null,
    transform: pickHome,
  });

  const [addReminderRequest, setAddReminderRequest] = useState(0);

  const primaryVenture = ventures[0] || null;
  const calendarEvents = homeData?.calendarEvents || [];
  const actionCenter = homeData?.actionCenter || {};
  const upcomingSessions = actionCenter.upcomingSessions || [];

  // Filter calendar events to meetings, sessions, and venture events (no student homework noise)
  const founderCalendarEvents = calendarEvents.filter(
    (e) => e.type === "venture_session" || e.type === "session" || e.type === "meeting" || e.type === "reminder",
  );

  const columns = [
    {
      key: "company",
      title: "Company",
      render: (_cell, row) => (
        <div className="flex items-center gap-3">
          {row.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={row.logo_url}
              alt={row.company_name || row.name || ""}
              className="w-9 h-9 rounded-xl object-contain bg-[var(--surface-1)] border border-[var(--border-primary)] p-0.5 shrink-0"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0 font-black text-sm"
              style={{
                background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                color: "var(--brand-orange)",
              }}
            >
              {(row.company_name || row.name || "V").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-[13px]" style={{ color: "var(--text-primary)" }}>
              {row.company_name || row.name || "Untitled Venture"}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-secondary)" }}>
              {row.industry || "General / Tech"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "program",
      title: "Cohort / Program",
      render: (_cell, row) => (
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {row.program_name || row.cohort_name || "Direct Incubator"}
        </span>
      ),
    },
    {
      key: "stage",
      title: "Stage",
      render: (_cell, row) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-primary)",
          }}
        >
          {row.business_stage || "Idea"}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (_cell, row) => <AppStatusBadge status={row.status || "active"} />,
    },
    {
      key: "actions",
      title: "",
      className: "text-right",
      render: (_cell, row) => {
        const ventureId = row.venture_id || row.id;
        return (
          <div className="flex justify-end">
            <AppButton
              size="sm"
              variant="ghost"
              icon={ArrowRight}
              className="text-xs font-bold"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/founder/ventures/${ventureId}`);
              }}
            >
              Workspace
            </AppButton>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {primaryVenture && (
        <StartupBroadcastBanner
          ventureId={primaryVenture.venture_id || primaryVenture.id}
          ventureName={primaryVenture.company_name || primaryVenture.name}
        />
      )}
      {/* ── 1. Page Hero ── */}
      <PageHero
        kicker="FOUNDER WORKSPACE"
        title={`Welcome back, ${user?.name || "Founder"}`}
        subtitle="Track execution milestones, review upcoming meetings, and collaborate with your Venture Manager."
        action={
          <div className="flex items-center gap-2">
            <CreateActions only={["venture"]} tone="primary" />
          </div>
        }
      />

      {/* ── 2. 4 Startup Executive KPIs ── */}
      <div className="stf-grid c4">
        <KpiCard
          label="Upcoming Sessions"
          value={upcomingSessions.length}
          hint={upcomingSessions.length > 0 ? "Office hours & syncs" : "No sessions booked"}
          icon={Calendar}
          loading={homeLoading}
        />
        <KpiCard
          label="Active Venture"
          value={primaryVenture?.company_name || primaryVenture?.name || "None"}
          hint={primaryVenture ? `Stage: ${(primaryVenture.business_stage || "Idea").toUpperCase()}` : "Provisioning required"}
          icon={Building2}
          loading={venturesLoading}
          onClick={primaryVenture ? () => router.push(`/founder/ventures/${primaryVenture.venture_id || primaryVenture.id}`) : undefined}
        />
        <KpiCard
          label="Total Companies"
          value={ventures.length}
          hint={ventures.length === 1 ? "1 active startup workspace" : `${ventures.length} active workspaces`}
          icon={Rocket}
          loading={venturesLoading}
        />
        <KpiCard
          label="Incubation Cadence"
          value="Weekly Sprints"
          hint="Deliverable & Review Cycles"
          icon={Layers}
          loading={false}
        />
      </div>

      {/* ── 3. Split Horizon: Calendar & Action Spotlight ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Founder Command Calendar (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="p-1.5 rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                  color: "var(--brand-orange)",
                }}
              >
                <Calendar size={16} />
              </div>
              <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                Founder Calendar & Agenda
              </h2>
            </div>
            <AppButton
              size="sm"
              variant="secondary"
              className="text-xs font-bold"
              onClick={() => setAddReminderRequest((prev) => prev + 1)}
            >
              + New Reminder
            </AppButton>
          </div>

          <ParticipantCommandCalendar
            events={founderCalendarEvents}
            addRequest={addReminderRequest}
          />
        </div>

        {/* Right: Active Venture Spotlight & Quick Access (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg"
              style={{
                background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                color: "var(--brand-orange)",
              }}
            >
              <Rocket size={16} />
            </div>
            <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
              Active Venture Spotlight
            </h2>
          </div>

          {primaryVenture ? (
            <AppCard padding="normal" className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {primaryVenture.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={primaryVenture.logo_url}
                      alt={primaryVenture.company_name || ""}
                      className="w-12 h-12 rounded-xl object-contain bg-[var(--surface-1)] border border-[var(--border-primary)] p-1 shrink-0 shadow-sm"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm"
                      style={{
                        background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                        color: "var(--brand-orange)",
                      }}
                    >
                      {(primaryVenture.company_name || "V").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
                      {primaryVenture.company_name || primaryVenture.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-3" style={{ color: "var(--text-secondary)" }}>
                        {primaryVenture.business_stage || "Idea"}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {primaryVenture.industry || "Technology"}
                      </span>
                    </div>
                  </div>
                </div>

                <AppStatusBadge status={primaryVenture.status || "active"} />
              </div>

              {primaryVenture.description && (
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                  {primaryVenture.description}
                </p>
              )}

              <div className="p-3.5 rounded-xl border border-[var(--border-primary)] bg-surface-2 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span style={{ color: "var(--text-primary)" }}>Studio Milestones</span>
                  <span className="text-[var(--brand-orange)] font-mono">Sprint Active</span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Open your venture workspace to review sprint deliverables, pitch deck data room, and co-founder settings.
                </p>
              </div>

              <div className="pt-2">
                <AppButton
                  variant="primary"
                  className="w-full text-xs font-bold justify-between"
                  onClick={() => router.push(`/founder/ventures/${primaryVenture.venture_id || primaryVenture.id}`)}
                >
                  <span>Launch Venture Workspace</span>
                  <ArrowRight size={14} />
                </AppButton>
              </div>
            </AppCard>
          ) : (
            <AppCard padding="normal" className="text-center py-8 space-y-4">
              <div
                className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center"
                style={{
                  background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                  color: "var(--brand-orange)",
                }}
              >
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  No Active Venture Found
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  You are not yet linked to a venture workspace.
                </p>
              </div>
              <CreateActions only={["venture"]} tone="primary" />
            </AppCard>
          )}
        </div>
      </div>

      {/* ── 4. My Ventures Table (shown if multiple ventures exist) ── */}
      {ventures.length > 1 && (
        <AppCard padding="none">
          <div className="p-5 flex items-center justify-between border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-2.5">
              <div
                className="p-1.5 rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                  color: "var(--brand-orange)",
                }}
              >
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                  My Ventures Portfolio
                </h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  All startup workspaces you own or contribute to
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-3" style={{ color: "var(--text-secondary)" }}>
              {ventures.length} Companies
            </span>
          </div>

          <AppTable
            columns={columns}
            data={ventures}
            loading={venturesLoading}
            emptyMessage="No ventures linked to your account."
            onRowClick={(row) => router.push(`/founder/ventures/${row.venture_id || row.id}`)}
          />
        </AppCard>
      )}
    </div>
  );
}
