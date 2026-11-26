"use client";

import {
  CalendarClock,
  FileSignature,
  Handshake,
  MessageSquare,
  PiggyBank,
  Sparkles,
} from "lucide-react";
import LinkCard from "@/components/ui/LinkCard";
import SectionHead from "@/components/ui/SectionHead";
import { useI18n } from "@/lib/i18n";

/**
 * Action-needed strip (Investor Guide §9.1).
 * Only cards that correspond to a real pending item are shown.
 */
export default function ActionNeededStrip({
  features = {},
  introductions = [],
  upcomingMeetings = [],
  unreadMessages = 0,
  pendingInvestments = 0,
  ndaRequired = false,
  onNavigate,
  onSchedule,
  onOpenMessages,
  onOpenNda,
}) {
  const { t } = useI18n();

  const pendingReview = introductions.filter((request) =>
    ["submitted", "under_review"].includes(request.status),
  );
  const approvedForMeeting = introductions.filter(
    (request) => request.status === "approved" && !request.meeting_scheduled,
  );

  const cards = [];

  if (ndaRequired) {
    cards.push({
      key: "nda",
      icon: FileSignature,
      tone: "o",
      title: t("dashboardV2.action.ndaTitle"),
      text: t("dashboardV2.action.ndaHint"),
      onClick: onOpenNda,
    });
  }

  if (features.introductions) {
    for (const request of approvedForMeeting.slice(0, 2)) {
      cards.push({
        key: `approved-${request.id}`,
        icon: Handshake,
        tone: "g",
        title: t("dashboardV2.action.introApproved"),
        text: request.venture_name || t("dashboardV2.action.scheduleMeeting"),
        tag: <span className="stf-tag g">{t("dashboardV2.status.approved")}</span>,
        onClick: () => onSchedule?.(request),
      });
    }
    if (pendingReview.length > 0) {
      cards.push({
        key: "intro-pending",
        icon: Sparkles,
        tone: "o",
        title: t("dashboardV2.action.introPending"),
        text: t("dashboardV2.introductionAction", { count: pendingReview.length }),
        tag: <span className="stf-tag o">{pendingReview.length}</span>,
        onClick: () => onNavigate?.("introductions"),
      });
    }
  }

  if (features.meetings && upcomingMeetings.length > 0) {
    cards.push({
      key: "meetings",
      icon: CalendarClock,
      tone: "b",
      title: t("dashboardV2.action.upcomingMeetings"),
      text: t("dashboardV2.action.upcomingMeetingsHint", {
        count: upcomingMeetings.length,
      }),
      tag: <span className="stf-tag b">{upcomingMeetings.length}</span>,
      onClick: () => onNavigate?.("meetings"),
    });
  }

  if (features.messaging && unreadMessages > 0) {
    cards.push({
      key: "messages",
      icon: MessageSquare,
      tone: "b",
      title: t("dashboardV2.action.unreadMessages"),
      text: t("dashboardV2.action.unreadMessagesHint", { count: unreadMessages }),
      tag: <span className="stf-tag b">{unreadMessages}</span>,
      onClick: onOpenMessages,
    });
  }

  if (features.investmentConfirmation && pendingInvestments > 0) {
    cards.push({
      key: "investments",
      icon: PiggyBank,
      tone: "o",
      title: t("dashboardV2.action.pendingInvestment"),
      text: t("dashboardV2.action.pendingInvestmentHint", {
        count: pendingInvestments,
      }),
      tag: <span className="stf-tag o">{pendingInvestments}</span>,
      onClick: () => onNavigate?.("pipeline"),
    });
  }

  if (cards.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="investor-actions-title">
      <SectionHead
        letter="A"
        tone="o"
        icon={Sparkles}
        title={t("dashboardV2.actionNeeded")}
        subtitle={t("dashboardV2.actionHint")}
      />
      <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-visible">
        {cards.map((card) => (
          <div key={card.key} className="min-w-[225px] flex-1 md:min-w-0">
            <LinkCard
              icon={card.icon}
              tone={card.tone}
              title={card.title}
              text={card.text}
              tag={card.tag}
              onClick={card.onClick}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
