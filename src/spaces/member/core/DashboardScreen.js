"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { formatLocaleDate } from "@/lib/constants";
import { spaceForRole, spaceHomeForRole } from "@/spaces/registry";
import AppButton from "@/components/ui/AppButton";
import AppCard from "@/components/ui/AppCard";
import PageHero from "@/components/ui/PageHero";
import LinkCard from "@/components/ui/LinkCard";
import ParticipantCommandCalendar from "@/components/ui/ParticipantCommandCalendar";
import { Skeleton } from "@/components/ui/Skeleton";
import CreateActions from "@/components/shared/create/CreateActions";
import ProgramSection from "./components/ProgramSection";
import FacilitatorSection from "./components/FacilitatorSection";
import VenturesSection from "./components/VenturesSection";
import LearningSection from "./components/LearningSection";
import InvestorSection from "./components/InvestorSection";

const pickDashboard = (payload) => (payload?.success ? payload : null);

/**
 * THE member dashboard — one page, for every member.
 *
 * It is not a "participant dashboard with extras": every section is a block the
 * server only sends when the matching relationship is true. A person without a
 * program seat receives no program block at all, so there is nothing to hide
 * here — the page renders what it was given.
 *
 * Sections, in reading order: program → facilitation → ventures → learning →
 * investor. The personal agenda and the announcements belong to the person and
 * are always shown.
 */
function subtitleFor(data, t) {
  const { programs, facilitator, ventures, learning, investor } = data;

  if (programs?.primary) {
    return `${programs.primary.name} · ${t("member.dashboard.week", {
      current: programs.primary.currentWeek,
      total: programs.primary.durationWeeks || "?",
    })}`;
  }
  if (programs) {
    return t("member.dashboard.subtitle.programs", { count: programs.seats.length });
  }
  if (facilitator) {
    return t("member.dashboard.subtitle.facilitator", { count: facilitator.programs.length });
  }
  if (ventures) {
    return ventures.isFounder
      ? t("member.dashboard.subtitle.founder")
      : t("member.dashboard.subtitle.ventures", { count: ventures.items.length });
  }
  if (learning) {
    return t("member.dashboard.subtitle.learning", { count: learning.courses.length });
  }
  if (investor) return t("member.dashboard.subtitle.investor");
  return t("member.dashboard.subtitle.none");
}

export default function DashboardScreen() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { role } = useSessionUser();
  const [addRequest, setAddRequest] = useState(0);
  const { data, loading, error, refresh } = useApi("/api/member/dashboard", {
    defaultValue: null,
    transform: pickDashboard,
  });

  // This address is the MEMBER home. A staff or admin identity that reaches it
  // belongs in its own section, and leaving it here would show a member page
  // under a staff sidebar.
  useEffect(() => {
    const space = spaceForRole(role);
    if (space && space !== "member") {
      router.replace(spaceHomeForRole(role) || "/login");
    }
  }, [role, router]);

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <AppCard>
        <p className="text-sm text-[var(--text-secondary)]">
          {t("member.dashboard.failedToLoad")}
        </p>
        <AppButton className="mt-3" icon={RefreshCw} onClick={refresh}>
          {t("common.retry")}
        </AppButton>
      </AppCard>
    );
  }

  const { identity, announcements = [], programs, facilitator, ventures, learning, investor } = data;
  const firstName = String(identity?.name || "").trim().split(/\s+/)[0];
  const hasSections = Boolean(
    programs || facilitator || ventures || learning || investor,
  );
  const latestAnnouncements = announcements.slice(0, 3);

  return (
    <div className="stf max-w-[1500px] mx-auto space-y-6">
      <PageHero
        kicker={formatLocaleDate(
          new Date(),
          { weekday: "long", day: "numeric", month: "long", year: "numeric" },
          lang,
        )}
        title={t("participant.template.welcome", {
          name: firstName || t("participant.defaultName"),
        })}
        subtitle={subtitleFor(data, t)}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <CreateActions />
            <button
              type="button"
              className="stf-btn pr"
              onClick={() => setAddRequest((previous) => previous + 1)}
            >
              <Plus size={15} /> {t("member.dashboard.newReminder")}
            </button>
          </div>
        }
      />

      <ParticipantCommandCalendar events={data.agenda || []} addRequest={addRequest} />

      {latestAnnouncements.length > 0 && (
        <AppCard>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {t("participant.announcements")}
            </h3>
            <Link className="stf-link-btn" href="/member/participant/announcements">
              {t("participant.announcementHub.open")}
            </Link>
          </div>
          <div className="mt-3 divide-y divide-[var(--border-primary)]">
            {latestAnnouncements.map((announcement) => (
              <div key={announcement.id} className="py-3">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {announcement.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                  {announcement.message}
                </p>
              </div>
            ))}
          </div>
        </AppCard>
      )}

      {programs && <ProgramSection block={programs} t={t} lang={lang} />}
      {facilitator && <FacilitatorSection block={facilitator} t={t} lang={lang} />}
      {ventures && <VenturesSection block={ventures} t={t} />}
      {learning && <LearningSection block={learning} t={t} />}
      {investor && <InvestorSection block={investor} t={t} />}

      {!hasSections && (
        <AppCard>
          <div className="space-y-2 py-8 text-center">
            <LayoutGrid className="mx-auto h-8 w-8 text-[var(--text-secondary)]" />
            <p className="text-sm font-black uppercase text-[var(--text-primary)]">
              {t("member.dashboard.empty.title")}
            </p>
            <p className="mx-auto max-w-lg text-xs text-[var(--text-secondary)]">
              {t("member.dashboard.empty.body")}
            </p>
          </div>
        </AppCard>
      )}

      <div className="stf-grid c5">
        <LinkCard
          icon={LayoutGrid}
          title={t("member.dashboard.mySpaces.title")}
          text={t("member.dashboard.mySpaces.text")}
          href="/member"
        />
      </div>
    </div>
  );
}
