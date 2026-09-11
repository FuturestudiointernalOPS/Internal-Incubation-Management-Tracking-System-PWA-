"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Rocket, Users, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer } from "@/components/permissions/effectUtils";
import { buildContextCards } from "./contextCards";

/**
 * ONE DASHBOARD — the additive part.
 *
 * Rendered on the dashboard that owns the calendar. Each card is a relationship
 * this person holds (programs they work in, programs they're enrolled in,
 * ventures delegated to them, ventures they are a member of, LMS enrollment) and
 * nothing else: a count, up to three names, one link to the full page.
 *
 * No context → no cards → no section. Two requests, cache-first, each failing
 * soft and independently: a broken lookup hides its card instead of breaking
 * the dashboard.
 */

const ICONS = {
  programsManaged: Users,
  programsParticipating: GraduationCap,
  venturesAssigned: Rocket,
  venturesMember: Rocket,
  learning: GraduationCap,
};

export default function ContextCardsPanel() {
  const { t } = useI18n();
  const [cards, setCards] = useState([]);

  useEffect(() => {
    defer(async () => {
      const read = async (url) => {
        try {
          const cached = cacheGet(url);
          const data = cached?.success ? cached : await (await fetch(url)).json();
          if (data?.success) cacheSet(url, data);
          return data?.success ? data : null;
        } catch {
          return null;
        }
      };
      const [workspaces, assigned] = await Promise.all([
        read("/api/workspaces"),
        read("/api/ventures/assigned"),
      ]);
      setCards(
        buildContextCards({
          contexts: workspaces?.contexts || {},
          assignedVentures: assigned?.assignments || [],
        }),
      );
    });
  }, []);

  if (cards.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-wide">
        {t("common.dashboardContexts.title")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = ICONS[card.key] || Users;
          return (
            <Link
              key={card.key}
              href={card.href}
              className="card !p-4 hover:bg-tertiary/40 transition-colors flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
            >
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wide">
                  {t(`common.dashboardContexts.${card.key}`)}
                </span>
              </span>
              <span className="text-lg font-black text-[var(--text-primary)]">
                {card.count === null
                  ? t("common.dashboardContexts.enrolled")
                  : t("common.dashboardContexts.count", { count: card.count })}
              </span>
              {card.names.length > 0 && (
                <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                  {card.names.join(" · ")}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] mt-auto">
                {t("common.dashboardContexts.open")}
                <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
