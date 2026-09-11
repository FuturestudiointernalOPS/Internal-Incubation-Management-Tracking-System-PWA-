"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Layers, ChevronDown, LayoutDashboard, Building2, GraduationCap, BookOpen, Rocket } from "lucide-react";
import { contextRoleLabelKey, activeContextFromPathname } from "@/lib/context";

/**
 * CONTEXT SWITCHER (Phase 2C)
 *
 * Lets a multi-context user switch between their legitimate contexts WITHOUT
 * logging out, creating another account, or changing session.role / contacts.role.
 *
 * The context list is derived SERVER-SIDE by /api/workspaces from the existing
 * contextual tables. Selecting a context stores an "active context" marker
 * locally and navigates to that context's existing workspace. Authorization is
 * ALWAYS enforced server-side by the destination workspace — this component is
 * pure navigation, never a permission grant.
 */

const BASELINE_LABEL_KEY = {
  super_admin: "roleSuperAdmin",
  staff: "roleStaff",
  member: "roleOther",
};

export default function ContextSwitcher() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/workspaces")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.success) setData(d);
      })
      .catch(() => {});
  }, []);

  const roleLabelKey = (role) => contextRoleLabelKey({ kind: "role", row: { role } });

  const go = (href, label, type, contextId) => {
    try {
      localStorage.setItem(
        "impactos_active_context",
        JSON.stringify({ type, contextId, href, label }),
      );
    } catch (_) {}
    setOpen(false);
    router.push(href || "/workspaces");
  };

  const ctx = data?.contexts || null;
  const orgItems = [
    ...(ctx?.org_memberships || []).map((g) => ({
      key: `org-${g.group_name}`,
      title: g.group_name,
      labelKey: roleLabelKey(/intern/i.test(String(g.group_name || "")) ? "intern" : "staff"),
      href: g.href,
      type: "org",
      contextId: g.group_name,
    })),
    ...(ctx?.responsibilities || []).map((r) => ({
      key: `resp-${r.key}`,
      title: r.name,
      labelKey: roleLabelKey(r.key),
      href: r.href,
      type: "responsibility",
      contextId: r.key,
    })),
  ];
  const programItems = [
    // NOTE: program ASSIGNMENTS (staff work inside a program) are deliberately
    // NOT switcher items — they are the staff surface's own work and appear as
    // stat cards on the dashboard. The switcher is for moving between genuinely
    // different surfaces, never between contexts of the same one.
    ...(ctx?.program_participations || []).map((p) => ({
      key: `part-${p.program_id}`,
      title: p.program_name || p.program_id,
      labelKey: "roleParticipant",
      href: p.href,
      type: "program_participation",
      contextId: p.program_id,
      completed: p.completed,
    })),
  ];
  const ventureItems = (ctx?.venture_memberships || []).map((v) => ({
    key: `venture-${v.venture_id}`,
    title: v.venture_name || v.venture_id,
    labelKey: contextRoleLabelKey({ kind: "venture", row: v }),
    href: v.href,
    type: "venture",
    contextId: v.venture_id,
  }));

  // LMS learner context — one aggregate "My Learning" item (navigation
  // label), labelled Learner, gated server-side by active enrollment.
  const learningItem =
    ctx?.learning?.enrolled && data?.user
      ? [
          {
            key: "learning",
            title: t("navigation.learning"),
            labelKey: "roleLearner",
            href: ctx.learning.href || "/participant/learning",
            type: "learning",
            contextId: "lms",
          },
        ]
      : [];

  // The hat currently worn: the context whose workspace contains this page.
  // Home/dashboard pages match nothing → no hat, baseline identity only.
  const hatItems = [...programItems, ...ventureItems, ...learningItem];
  const activeItem = activeContextFromPathname(pathname, hatItems);

  // Baseline identity chip: only when the raw stored role is one of the three
  // baseline identities (super_admin / staff / member). Legacy contextual
  // stored values (e.g. an old mutated "participant") hide the chip.
  const baselineKey = BASELINE_LABEL_KEY[String(data?.user?.baseline_role || "")];
  const baselineLabel = baselineKey ? t(`common.workspaces.${baselineKey}`) : null;

  const totalItems =
    orgItems.length + programItems.length + ventureItems.length + learningItem.length;

  if (!data || totalItems === 0) return null;

  const Item = ({ item }) => {
    const isActive = !!activeItem && item.key === activeItem.key;
    return (
      <button
        onClick={() => go(item.href, item.title, item.type, item.contextId)}
        className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary transition-all ${
          isActive ? "bg-primary" : ""
        }`}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-tight text-[var(--text-primary)] truncate">
          {isActive && (
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--brand-orange)]" />
          )}
          <span className="truncate">{item.title}</span>
          {item.completed && (
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] shrink-0">
              {t("common.workspaces.completedViewOnly")}
            </span>
          )}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-0.5">
          {t(`common.workspaces.${item.labelKey}`)}
        </p>
      </button>
    );
  };

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-primary)] bg-primary/50 text-[10px] font-bold uppercase tracking-wide transition-all ${
          activeItem
            ? "text-[var(--brand-orange)] border-[var(--brand-orange)]/40 hover:text-[var(--brand-orange)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
        title={
          activeItem
            ? `${t(`common.workspaces.${activeItem.labelKey}`)} — ${activeItem.title}`
            : t("common.workspaces.contexts")
        }
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="hidden lg:inline truncate max-w-[160px]">
          {activeItem
            ? t(`common.workspaces.${activeItem.labelKey}`)
            : t("common.workspaces.contexts")}
        </span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[210]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-72 max-h-[70vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-[220] p-2">
            {baselineLabel && (
              <div className="px-3 py-2 mb-1 rounded-lg bg-primary/60 border border-[var(--border-primary)] flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("common.workspaces.baselineIdentity")}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] truncate">
                  {baselineLabel}
                </span>
              </div>
            )}
            <button
              onClick={() => go(data.home || "/workspaces", "Dashboard", "home", null)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary transition-all flex items-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                {t("common.workspaces.myDashboard")}
              </span>
            </button>

            {orgItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
                <p className="px-3 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  <Building2 className="w-3 h-3" />
                  {t("common.workspaces.groupFutureStudio")}
                </p>
                {orgItems.map((item) => (
                  <Item key={item.key} item={item} />
                ))}
              </div>
            )}

            {programItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
                <p className="px-3 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  <GraduationCap className="w-3 h-3" />
                  {t("common.workspaces.groupPrograms")}
                </p>
                {programItems.map((item) => (
                  <Item key={item.key} item={item} />
                ))}
              </div>
            )}

            {learningItem.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
                <p className="px-3 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  <BookOpen className="w-3 h-3" />
                  {t("common.workspaces.groupLearning")}
                </p>
                {learningItem.map((item) => (
                  <Item key={item.key} item={item} />
                ))}
              </div>
            )}

            {ventureItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
                <p className="px-3 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  <Rocket className="w-3 h-3" />
                  {t("common.workspaces.groupVentures")}
                </p>
                {ventureItems.map((item) => (
                  <Item key={item.key} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
