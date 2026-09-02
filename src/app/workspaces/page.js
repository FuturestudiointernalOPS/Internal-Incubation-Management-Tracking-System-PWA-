"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { LayoutGrid, LogOut, Loader2, ArrowRight, User, Building2, GraduationCap, Rocket } from "lucide-react";

/**
 * WORKSPACES HUB — CONTEXTUAL SELECTOR (Phase 2B)
 *
 * Lists every legitimate context the authenticated user holds, grouped by
 * area (Future Studio / Programs / Ventures). All data is derived server-side
 * by /api/workspaces from the existing contextual tables. Selecting a context
 * navigates to its existing workspace; the server still enforces every
 * relationship, capability and scope on the destination pages.
 *
 * A user with no assignments sees an empty state — having no assignment is a
 * valid platform state.
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

export default function WorkspacesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadWorkspaces = async (bypassCache = false) => {
      const url = "/api/workspaces";
      const apply = (d) => {
        if (!d) return;
        if (d.success) setData(d);
        else setError(true);
      };
      let painted = false;
      setLoading(true);
      try {
        // Cache-first paint: returning to this page renders instantly from a fresh
        // snapshot; the network refresh below converges.
        if (!bypassCache) {
          const cached = cacheGet(url);
          if (cached !== null && cached.success) {
            apply(cached);
            setLoading(false);
            painted = true;
          }
        }
        const res = await fetch(url);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const d = await res.json();
        if (d.success) cacheSet(url, d);
        apply(d);
      } catch (_) {
        if (!painted) setError(true);
      } finally {
        setLoading(false);
      }
    };
    loadWorkspaces();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (_) {}
    localStorage.clear();
    router.replace("/login");
  };

  const roleLabel = (role) => {
    const key = ROLE_LABEL_KEY[String(role || "").toLowerCase()] || "roleOther";
    return t(`common.workspaces.${key}`);
  };

  const orgLabel = (groupName) => {
    return /intern/i.test(String(groupName || ""))
      ? roleLabel("intern")
      : roleLabel("staff");
  };

  const contexts = data?.contexts || null;
  const hasAny =
    !!contexts &&
    (contexts.program_assignments.length > 0 ||
      contexts.program_participations.length > 0 ||
      contexts.org_memberships.length > 0 ||
      contexts.org_history.length > 0 ||
      contexts.responsibilities.length > 0 ||
      contexts.venture_memberships.length > 0);

  // Legacy fallback: environments where the contextual tables are absent still
  // show the previous flat assignment list instead of an empty state.
  const hasLegacy = !hasAny && (data?.workspaces?.length || 0) > 0;

  const ContextCard = ({ title, role, href, completed, badge }) => (
    <Link
      href={href || "/workspaces"}
      className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border-primary)] bg-secondary hover:border-[var(--brand-orange)] transition-all"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[12px] font-black uppercase truncate text-[var(--text-primary)]">
            {title}
          </p>
          {(completed || badge) && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[8px] font-black uppercase tracking-wider text-[var(--brand-orange)]">
              {t("common.workspaces.completedViewOnly")}
            </span>
          )}
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-1">
          {role}
        </p>
      </div>
      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] shrink-0">
        {t("common.workspaces.open")}
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );

  const Group = ({ icon: Icon, label, children }) => (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        <Icon className="w-4 h-4" />
        {label}
      </h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary">
      <header className="sticky top-0 z-40 bg-secondary border-b border-[var(--border-primary)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            {t("common.workspaces.title")}
          </h1>
          <div className="flex items-center gap-4">
            <Link
              href="/participant/profile"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              {t("common.workspaces.profile")}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t("common.workspaces.logout")}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {error ? (
          <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-10 text-center">
            <p className="text-[11px] font-bold uppercase text-[var(--text-secondary)]">
              {t("errors.somethingWrong")}
            </p>
          </div>
        ) : (
          <>
            {data?.user?.name && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("common.workspaces.welcome", { name: data.user.name })}
              </p>
            )}

            {hasAny ? (
              <div className="space-y-8">
                {/* Future Studio — org memberships + responsibilities */}
                {(contexts.org_memberships.length > 0 ||
                  contexts.responsibilities.length > 0) && (
                  <Group icon={Building2} label={t("common.workspaces.groupFutureStudio")}>
                    {contexts.org_memberships.map((g, i) => (
                      <ContextCard
                        key={`org-${g.group_name}-${i}`}
                        title={g.group_name}
                        role={orgLabel(g.group_name)}
                        href={g.href}
                      />
                    ))}
                    {contexts.responsibilities.map((r, i) => (
                      <ContextCard
                        key={`resp-${r.key}-${i}`}
                        title={r.name}
                        role={roleLabel(r.key)}
                        href={r.href}
                      />
                    ))}
                  </Group>
                )}

                {/* Past / ended organizational memberships — history is preserved */}
                {contexts.org_history.length > 0 && (
                  <Group
                    icon={Building2}
                    label={t("common.workspaces.groupPast")}
                  >
                    {contexts.org_history.map((m, i) => (
                      <div
                        key={`past-${m.group_name}-${i}`}
                        className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border-primary)] bg-secondary opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="text-[12px] font-black uppercase truncate text-[var(--text-primary)]">
                            {m.group_name}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-1">
                            {m.status}
                            {m.started_at
                              ? ` · ${new Date(m.started_at).toLocaleDateString()} → ${
                                  m.expires_at
                                    ? new Date(m.expires_at).toLocaleDateString()
                                    : "…"
                                }`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </Group>
                )}

                {/* Programs — assignments + participations */}
                {(contexts.program_assignments.length > 0 ||
                  contexts.program_participations.length > 0) && (
                  <Group icon={GraduationCap} label={t("common.workspaces.groupPrograms")}>
                    {contexts.program_assignments.map((a, i) => (
                      <ContextCard
                        key={`assign-${a.program_id}-${i}`}
                        title={a.program_name || a.program_id}
                        role={roleLabel(a.role || a.title)}
                        href={a.href}
                      />
                    ))}
                    {contexts.program_participations.map((p, i) => (
                      <ContextCard
                        key={`part-${p.program_id}-${i}`}
                        title={p.program_name || p.program_id}
                        role={roleLabel("participant")}
                        href={p.href}
                        completed={p.completed}
                      />
                    ))}
                  </Group>
                )}

                {/* Ventures — existing memberships */}
                {contexts.venture_memberships.length > 0 && (
                  <Group icon={Rocket} label={t("common.workspaces.groupVentures")}>
                    {contexts.venture_memberships.map((v, i) => (
                      <ContextCard
                        key={`venture-${v.venture_id}-${i}`}
                        title={v.venture_name || v.venture_id}
                        role={roleLabel("participant")}
                        href={v.href}
                      />
                    ))}
                  </Group>
                )}
              </div>
            ) : hasLegacy ? (
              <div className="grid gap-3">
                {data.workspaces.map((w, i) => (
                  <ContextCard
                    key={`${w.program_id}-${i}`}
                    title={w.program_name}
                    role={`${t("common.workspaces.role")}: ${w.title}`}
                    href={w.href}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-12 text-center space-y-3">
                <LayoutGrid className="w-8 h-8 text-[var(--text-secondary)] mx-auto" />
                <p className="text-[12px] font-black uppercase text-[var(--text-primary)]">
                  {t("common.workspaces.emptyTitle")}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {t("common.workspaces.emptyBody")}
                </p>
              </div>
            )}

            {data?.home && (
              <div className="text-center">
                <Link
                  href={data.home}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                >
                  {t("common.workspaces.myDashboard")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
