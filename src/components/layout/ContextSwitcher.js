"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Layers, ChevronDown, LayoutDashboard, Building2, GraduationCap, Rocket } from "lucide-react";

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

const ROLE_LABEL_KEY = {
  facilitator: "roleFacilitator",
  participant: "roleParticipant",
  staff: "roleStaff",
  program_manager: "roleProgramManager",
  teacher: "roleTeacher",
  finance: "roleFinance",
  intern: "roleIntern",
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

  const roleLabel = (role) => {
    const key = ROLE_LABEL_KEY[String(role || "").toLowerCase()] || "roleOther";
    return t(`common.workspaces.${key}`);
  };

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
      role: roleLabel(/intern/i.test(String(g.group_name || "")) ? "intern" : "staff"),
      href: g.href,
      type: "org",
      contextId: g.group_name,
    })),
    ...(ctx?.responsibilities || []).map((r) => ({
      key: `resp-${r.key}`,
      title: r.name,
      role: roleLabel(r.key),
      href: r.href,
      type: "responsibility",
      contextId: r.key,
    })),
  ];
  const programItems = [
    ...(ctx?.program_assignments || []).map((a) => ({
      key: `assign-${a.program_id}-${a.role}`,
      title: a.program_name || a.program_id,
      role: roleLabel(a.role || a.title),
      href: a.href,
      type: "program_assignment",
      contextId: a.program_id,
    })),
    ...(ctx?.program_participations || []).map((p) => ({
      key: `part-${p.program_id}`,
      title: p.program_name || p.program_id,
      role: roleLabel("participant"),
      href: p.href,
      type: "program_participation",
      contextId: p.program_id,
      completed: p.completed,
    })),
  ];
  const ventureItems = (ctx?.venture_memberships || []).map((v) => ({
    key: `venture-${v.venture_id}`,
    title: v.venture_name || v.venture_id,
    role: roleLabel("participant"),
    href: v.href,
    type: "venture",
    contextId: v.venture_id,
  }));

  const totalItems =
    orgItems.length + programItems.length + ventureItems.length;

  if (!data || totalItems === 0) return null;

  const Item = ({ item }) => (
    <button
      onClick={() => go(item.href, item.title, item.type, item.contextId)}
      className={`w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary transition-all ${
        pathname === item.href ? "bg-primary" : ""
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-tight text-[var(--text-primary)] truncate">
        {item.title}
        {item.completed && (
          <span className="ml-2 text-[8px] font-black uppercase tracking-wider text-[var(--brand-orange)]">
            {t("common.workspaces.completedViewOnly")}
          </span>
        )}
      </p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
        {item.role}
      </p>
    </button>
  );

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-primary)] bg-primary/50 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
        title={t("common.workspaces.contexts")}
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">{t("common.workspaces.contexts")}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[210]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-72 max-h-[70vh] overflow-y-auto bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-[220] p-2">
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
                <p className="px-3 pb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
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
                <p className="px-3 pb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  <GraduationCap className="w-3 h-3" />
                  {t("common.workspaces.groupPrograms")}
                </p>
                {programItems.map((item) => (
                  <Item key={item.key} item={item} />
                ))}
              </div>
            )}

            {ventureItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--border-primary)]">
                <p className="px-3 pb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
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
