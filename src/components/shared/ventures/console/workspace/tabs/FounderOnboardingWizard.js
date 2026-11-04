"use client";

import React, { useState } from "react";
import {
  Rocket,
  CheckCircle2,
  Circle,
  ArrowRight,
  UserCheck,
  Building,
  Users,
  Compass,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "@/components/ui/AppButton";

const pickSupport = (payload) => (payload?.success ? payload.support || null : null);

/**
 * FounderOnboardingWizard
 * 
 * Guided Day-1 launchpad for startup founders inside their Venture Workspace.
 * Introduces their designated Venture Manager (Handler) and gives them a clear,
 * actionable checklist to complete setup without getting lost across tabs.
 */
export default function FounderOnboardingWizard({
  venture,
  onSection,
  form,
  team,
  journeyStages = [],
}) {
  const ventureId = venture?.venture_id || venture?.id;

  // Initialize collapse state safely from storage
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined" || !ventureId) return false;
    try {
      return localStorage.getItem(`fs_wizard_collapsed_${ventureId}`) === "true";
    } catch {
      return false;
    }
  });

  // Fetch support team to identify the designated Venture Manager
  const { data: support } = useApi(
    ventureId ? `/api/ventures/${ventureId}/support` : null,
    { defaultValue: null, transform: pickSupport, deps: [ventureId] }
  );

  const leadManager = support?.primary_lead || (support?.team || []).find(
    (p) => p.responsibility_code === "venture_manager" && p.active
  );

  // Profile completion evaluation
  const hasDescription = Boolean(form?.description && form.description.trim().length > 10);
  const hasIndustry = Boolean(form?.industry);
  const hasLogo = Boolean(form?.logo_url);
  const profileComplete = hasDescription && hasIndustry && hasLogo;

  // Team setup evaluation
  const founderCount = team?.founders ?? 1;
  const teamCount = (team?.team ?? 0) + founderCount;
  const teamDone = teamCount > 1;

  // Journey readiness
  const journeyReady = journeyStages && journeyStages.length > 0;

  // Calculate step progress
  const completedSteps = (profileComplete ? 1 : 0) + (teamDone ? 1 : 0) + (journeyReady ? 1 : 0);
  const totalSteps = 3;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const toggleCollapse = () => {
    const nextState = !collapsed;
    setCollapsed(nextState);
    if (typeof window !== "undefined" && ventureId) {
      try {
        localStorage.setItem(`fs_wizard_collapsed_${ventureId}`, String(nextState));
      } catch {
        // Storage access handled gracefully
      }
    }
  };

  return (
    <div
      className="rounded-2xl border p-5 transition-all mb-4 overflow-hidden"
      style={{
        background: "linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)",
        borderColor: "var(--border-primary)",
      }}
    >
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{
              background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
              color: "var(--brand-orange)",
            }}
          >
            <Rocket size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-black uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                Founder Launchpad
              </h2>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                style={{
                  background:
                    progressPercent === 100
                      ? "color-mix(in srgb, #10B981 18%, transparent)"
                      : "color-mix(in srgb, var(--brand-orange) 18%, transparent)",
                  color: progressPercent === 100 ? "#10B981" : "var(--brand-orange)",
                }}
              >
                {progressPercent === 100 ? "Ready to Build" : `${completedSteps}/${totalSteps} Steps`}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {leadManager ? (
                <>
                  Assigned Lead Handler:{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {leadManager.name || leadManager.email}
                  </strong>
                </>
              ) : (
                "Welcome to Future Studio. Follow these steps to complete your venture onboarding."
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleCollapse}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-surface-3"
          style={{ color: "var(--text-secondary)" }}
        >
          {collapsed ? (
            <>
              Show Checklist <ChevronDown size={14} />
            </>
          ) : (
            <>
              Minimize <ChevronUp size={14} />
            </>
          )}
        </button>
      </div>

      {/* ── Expanded Steps Grid ── */}
      {!collapsed && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t" style={{ borderColor: "var(--border-primary)" }}>
          
          {/* Step 1: Company Profile */}
          <div
            className="rounded-xl p-4 flex flex-col justify-between border transition-all"
            style={{
              background: "var(--surface-1)",
              borderColor: profileComplete ? "color-mix(in srgb, #10B981 30%, transparent)" : "var(--border-primary)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                  <Building size={14} className="text-[var(--brand-orange)]" />
                  1. Company Profile
                </span>
                {profileComplete ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Circle size={16} style={{ color: "var(--text-tertiary)" }} />
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {profileComplete
                  ? "Your core profile, industry, and description are configured."
                  : "Add your company description, mission, and website."}
              </p>
            </div>

            <div className="mt-4 pt-2">
              <AppButton
                size="sm"
                variant={profileComplete ? "secondary" : "primary"}
                className="w-full text-xs font-bold justify-between"
                onClick={() => onSection?.("profile")}
              >
                <span>{profileComplete ? "Review Profile" : "Complete Profile"}</span>
                <ArrowRight size={14} />
              </AppButton>
            </div>
          </div>

          {/* Step 2: Team & Co-founders */}
          <div
            className="rounded-xl p-4 flex flex-col justify-between border transition-all"
            style={{
              background: "var(--surface-1)",
              borderColor: teamDone ? "color-mix(in srgb, #10B981 30%, transparent)" : "var(--border-primary)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                  <Users size={14} className="text-[var(--brand-orange)]" />
                  2. Co-Founders & Team
                </span>
                {teamDone ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Circle size={16} style={{ color: "var(--text-tertiary)" }} />
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {teamDone
                  ? `${teamCount} team members linked to this venture workspace.`
                  : "Invite your co-founders or key team members to collaborate."}
              </p>
            </div>

            <div className="mt-4 pt-2">
              <AppButton
                size="sm"
                variant={teamDone ? "secondary" : "primary"}
                className="w-full text-xs font-bold justify-between"
                onClick={() => onSection?.("team")}
              >
                <span>{teamDone ? "Manage Team" : "Invite Co-Founders"}</span>
                <ArrowRight size={14} />
              </AppButton>
            </div>
          </div>

          {/* Step 3: Journey & Milestones */}
          <div
            className="rounded-xl p-4 flex flex-col justify-between border transition-all"
            style={{
              background: "var(--surface-1)",
              borderColor: journeyReady ? "color-mix(in srgb, #10B981 30%, transparent)" : "var(--border-primary)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                  <Compass size={14} className="text-[var(--brand-orange)]" />
                  3. Program Journey
                </span>
                {journeyReady ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <UserCheck size={16} style={{ color: "var(--text-tertiary)" }} />
                )}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {journeyReady
                  ? `${journeyStages.length} stage roadmap configured for your cohort.`
                  : "Your Lead Handler will configure your cohort roadmap and milestones."}
              </p>
            </div>

            <div className="mt-4 pt-2">
              <AppButton
                size="sm"
                variant={journeyReady ? "secondary" : "ghost"}
                disabled={!journeyReady}
                className="w-full text-xs font-bold justify-between"
                onClick={() => onSection?.("journey")}
              >
                <span>{journeyReady ? "View Roadmap" : "In Preparation"}</span>
                <ArrowRight size={14} />
              </AppButton>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
