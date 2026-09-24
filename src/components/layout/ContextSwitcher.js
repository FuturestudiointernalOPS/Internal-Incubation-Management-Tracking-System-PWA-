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
    // `scope=contexts`: this list is all the switcher renders. Asking for the
    // rest (the flat assignment list, the program assignments, the past
    // memberships) meant four statements on the widest database burst of every
    // page in the product, for data this component never reads.
    fetch("/api/workspaces?scope=contexts")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload && payload.success) setData(payload);
      })
      .catch(() => {});
  }, []);

  const roleLabelKey = (role) => contextRoleLabelKey({ kind: "role", row: { role } });

  const go = (href, label, type, contextId) => {
    try {
      if (type === "home") {
        // Returning to the dashboard wears no hat — drop the context marker so
        // the next load starts from the baseline identity, not the last
        // workspace visited.
        localStorage.removeItem("impactos_active_context");
      } else {
        localStorage.setItem(
          "impactos_active_context",
          JSON.stringify({ type, contextId, href, label }),
        );
      }
    } catch (_) {}
    setOpen(false);
    router.push(href || "/workspaces");
  };

  const contexts = data?.contexts || null;
  const orgItems = [
    ...(contexts?.org_memberships || []).map((group) => ({
      key: `org-${group.group_name}`,
      title: group.group_name,
      labelKey: roleLabelKey(/intern/i.test(String(group.group_name || "")) ? "intern" : "staff"),
      href: group.href,
      type: "org",
      contextId: group.group_name,
    })),
    ...(contexts?.responsibilities || []).map((responsibility) => ({
      key: `resp-${responsibility.key}`,
      title: responsibility.name,
      labelKey: roleLabelKey(responsibility.key),
      href: responsibility.href,
      type: "responsibility",
      contextId: responsibility.key,
    })),
  ];
  const programItems = [
    // NOTE: program ASSIGNMENTS (staff work inside a program) are deliberately
    // NOT switcher items — they are the staff surface's own work and appear as
    // stat cards on the dashboard. The switcher is for moving between genuinely
    // different surfaces, never between contexts of the same one.
    ...(contexts?.program_participations || []).map((participation) => ({
      key: `part-${participation.program_id}`,
      title: participation.program_name || participation.program_id,
      labelKey: "roleParticipant",
      href: participation.href,
      type: "program_participation",
      contextId: participation.program_id,
      completed: participation.completed,
    })),
  ];
  const ventureItems = (contexts?.venture_memberships || []).map((membership) => ({
    key: `venture-${membership.venture_id}`,
    title: membership.venture_name || membership.venture_id,
    labelKey: contextRoleLabelKey({ kind: "venture", row: membership }),
    href: membership.href,
    type: "venture",
    contextId: membership.venture_id,
  }));

  // LMS learner context — one aggregate "My Learning" item (navigation
  // label), labelled Learner, gated server-side by active enrollment.
  const learningItem =
    contexts?.learning?.enrolled && data?.user
      ? [
          {
            key: "learning",
            title: t("navigation.learning"),
            labelKey: "roleLearner",
            href: contexts.learning.href || "/participant/learning",
            type: "learning",
            contextId: "lms",
          },
        ]
      : [];

  // The hat currently worn: the context whose workspace contains this page.
  // Home/dashboard pages match nothing → no hat, baseline identity only.
  const hatItems = [...programItems, ...ventureItems, ...learningItem];
  const activeItem = activeContextFromPathname(pathname, hatItems);

  // Where "back to my dashboard" goes, and whether we are already there.
  const homeHref = data?.home || "/workspaces";
  const onDashboard = pathname === homeHref;

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
            ? "text-[var(--brand-orange)] border-brand-orange/40 hover:text-[var(--brand-orange)]"
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
              onClick={() => go(homeHref, t("common.workspaces.myDashboard"), "home", null)}
              aria-current={onDashboard ? "page" : undefined}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary transition-all flex items-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                {t("common.workspaces.myDashboard")}
              </span>
              {onDashboard && (
                <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--brand-orange)]" />
              )}
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
