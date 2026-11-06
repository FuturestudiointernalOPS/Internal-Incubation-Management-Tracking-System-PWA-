"use client";

import { LayoutDashboard, MessageSquare, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

/**
 * Phone bottom bar (Guide §9.1): Dashboard · Messages · Profile.
 * Messages stays disabled until the messaging flag is on.
 */
export default function InvestorMobileNav({ messagingEnabled = false }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || "";

  const items = [
    {
      id: "dashboard",
      label: t("dashboardV2.nav.dashboard"),
      icon: LayoutDashboard,
      href: "/investor/dashboard",
      enabled: true,
    },
    {
      id: "messages",
      label: t("dashboardV2.nav.messages"),
      icon: MessageSquare,
      href: "/investor/messages",
      enabled: messagingEnabled,
    },
    {
      id: "profile",
      label: t("dashboardV2.nav.profile"),
      icon: UserRound,
      href: "/investor/profile",
      enabled: true,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-[var(--border-primary)] bg-[var(--surface-1)]/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden"
      aria-label={t("dashboardV2.nav.label")}
    >
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!item.enabled}
            onClick={() => item.enabled && router.push(item.href)}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${
              active
                ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                : "text-[var(--text-secondary)]"
            } disabled:cursor-not-allowed disabled:opacity-40`}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
