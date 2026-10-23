"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity, Building2, Calendar, FileText, FolderKanban, FolderOpen, Rocket, Route,
  TrendingUp, UserPlus, Users,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import AddLeadManagerModal from "./AddLeadManagerModal";

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);

const STAGE = {
  idea: ["vadmin.detail.stageIdea", "text-blue-400 bg-blue-500/10"],
  validation: ["vadmin.detail.stageValidation", "text-purple-400 bg-purple-500/10"],
  early_traction: ["vadmin.detail.stageEarlyTraction", "text-amber-400 bg-amber-500/10"],
  growth: ["vadmin.detail.stageGrowth", "text-emerald-400 bg-emerald-500/10"],
  scaling: ["vadmin.detail.stageScaling", "text-[var(--brand-orange)] bg-brand-orange/10"],
};

/**
 * THE VENTURE'S NAVIGATION BAR — one bar, on every page of a Venture.
 *
 * It carries the Venture's name and the tabs that take you anywhere in it
 * (Dashboard, Journey, Investment Readiness, Reports, Data Room, Activity,
 * Profile, Team) plus Project and the Staff menu. It sits in the Venture's
 * layout, so no page repeats it and no page needs a "back to…" link: the bar
 * IS the way around. The active tab follows the address.
 */
export default function VentureHubNav({ id }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const base = `/admin/ventures/${id}`;
  const { data: venture } = useApi(id ? `/api/ventures/${id}` : null, {
    defaultValue: null,
    transform: pickVenture,
    deps: [id],
  });

  const [showLeadManager, setShowLeadManager] = useState(false);
  const [staffMenu, setStaffMenu] = useState(false);
  const staffMenuRef = useRef(null);
  useEffect(() => {
    if (!staffMenu) return undefined;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !staffMenuRef.current?.contains(event.target)) {
        setStaffMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [staffMenu]);

  const tab = searchParams?.get("tab") || "";
  const atHub = pathname === base || pathname === `${base}/`;
  const TABS = [
    { key: "dashboard", label: "vadmin.detail.dashboard", icon: Rocket, href: base, active: atHub && (tab === "" || tab === "dashboard") },
    { key: "journey", label: "vadmin.detail.journeyTab", icon: Route, href: `${base}/journey`, active: pathname.startsWith(`${base}/journey`) },
    { key: "investment", label: "vadmin.detail.investmentReadiness", icon: TrendingUp, href: `${base}/investment`, active: pathname.startsWith(`${base}/investment`) },
    { key: "reports", label: "vadmin.detail.reports", icon: FileText, href: `${base}/reports`, active: pathname.startsWith(`${base}/reports`) },
    // The Data Room is the venture's confidential fundraising / due-diligence document set.
    { key: "dataRoom", label: "dataRoom.title", icon: FolderOpen, href: `${base}/documents`, active: pathname.startsWith(`${base}/documents`) },
    { key: "activity", label: "vadmin.detail.activity", icon: Activity, href: `${base}?tab=activity`, active: atHub && tab === "activity" },
    { key: "profile", label: "vadmin.detail.profile", icon: Building2, href: `${base}?tab=profile`, active: atHub && (tab === "profile" || tab === "overview") },
    { key: "team", label: "vadmin.detail.team", icon: Users, href: `${base}?tab=team`, active: atHub && (tab === "team" || tab === "founders") },
  ];
  const onProject = pathname.startsWith(`${base}/projects`);
  const [stageLabel, stageColor] = STAGE[venture?.business_stage] || STAGE.idea;

  return (
    <>
      <div className="card mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-[var(--brand-orange)]" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-[var(--text-primary)]">{venture?.company_name || "…"}</h1>
                {venture && (
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${stageColor}`}>{t(stageLabel)}</span>
                )}
              </div>
              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                <span className="font-mono">{venture?.venture_id || id}</span>
                {venture?.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {t("vadmin.detail.registered", { date: new Date(venture.created_at).toLocaleDateString(lang) })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {/* Staff: who manages/coaches this Venture — and inviting a founder. */}
            <div className="relative" ref={staffMenuRef}>
              <button
                onClick={() => setStaffMenu((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={staffMenu}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
                title={t("vadmin.detail.staffTitle")}
              >
                <Users className="w-3 h-3" /> {t("vadmin.detail.staff")}
              </button>
              {staffMenu && (
                <div role="menu" className="absolute right-0 z-[60] mt-1 min-w-[220px] rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] shadow-2xl py-1">
                  <button
                    role="menuitem"
                    onClick={() => { setStaffMenu(false); setShowLeadManager(true); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] font-bold hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" /> {t("vadmin.detail.addLeadManager")}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setStaffMenu(false); router.push(`${base}/founders`); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] font-bold hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> {t("vadmin.dashboard.inviteFounder")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-3 mt-8 border-b border-[var(--border-primary)]" aria-label={t("vadmin.detail.navigation")}>
          <div className="flex flex-1 min-w-0 gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={`px-5 py-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
                    item.active
                      ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                      : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {t(item.label)}
                </Link>
              );
            })}
          </div>
          <div className="flex shrink-0 gap-2 pb-2">
            <Link
              href={`${base}/projects`}
              aria-current={onProject ? "page" : undefined}
              className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                onProject ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-[var(--border-primary)] hover:bg-tertiary"
              }`}
            >
              <FolderKanban className="w-3 h-3" /> {t("vadmin.detail.journey")}
            </Link>
          </div>
        </nav>
      </div>

      {showLeadManager && <AddLeadManagerModal onClose={() => setShowLeadManager(false)} ventureId={id} />}
    </>
  );
}
