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
  finance: "roleFinance",
  intern: "roleIntern",
};

/**
 * Card linking to one workspace. Declared at module scope, not inside the page:
 * a component created during render is a new element type on every render, so
 * React remounts it each time — which resets hover and focus on the links and
 * restarts their preloading.
 */
const ContextCard = ({ title, role, href, completed, badge }) => {
  const { t } = useI18n();
  return (
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
            <span className="px-2 py-0.5 rounded-full bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)]">
              {t("common.workspaces.completedViewOnly")}
            </span>
          )}
        </div>
        {role && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {role}
          </p>
        )}
        </div>
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] shrink-0">
        {t("common.workspaces.open")}
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
};

const Group = ({ icon: Icon, label, children }) => (
  <section className="space-y-3">
    <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
      <Icon className="w-4 h-4" />
      {label}
    </h2>
    <div className="grid gap-3">{children}</div>
  </section>
);

export default function WorkspacesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadWorkspaces = async (bypassCache = false) => {
      const url = "/api/workspaces";
      const applyWorkspaces = (payload) => {
        if (!payload) return;
        if (payload.success) setData(payload);
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
            applyWorkspaces(cached);
            setLoading(false);
            painted = true;
          }
        }
        const response = await fetch(url);
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = await response.json();
        if (payload.success) cacheSet(url, payload);
        applyWorkspaces(payload);
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
                    {contexts.org_memberships.map((membership, index) => (
                      <ContextCard
                        key={`org-${membership.group_name}-${index}`}
                        title={membership.group_name}
                        role={orgLabel(membership.group_name)}
                        href={membership.href}
                      />
                    ))}
                    {contexts.responsibilities.map((responsibility, index) => (
                      <ContextCard
                        key={`resp-${responsibility.key}-${index}`}
                        title={responsibility.name}
                        role={roleLabel(responsibility.key)}
                        href={responsibility.href}
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
                    {contexts.org_history.map((membership, index) => (
                      <div
                        key={`past-${membership.group_name}-${index}`}
                        className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border-primary)] bg-secondary opacity-60"
                      >
                        <div className="min-w-0">
                          <p className="text-[12px] font-black uppercase truncate text-[var(--text-primary)]">
                            {membership.group_name}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                            {membership.status}
                            {membership.started_at
                              ? ` · ${new Date(membership.started_at).toLocaleDateString()} → ${
                                  membership.expires_at
                                    ? new Date(membership.expires_at).toLocaleDateString()
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
                    {contexts.program_assignments.map((assignment, index) => (
                      <ContextCard
                        key={`assign-${assignment.program_id}-${index}`}
                        title={assignment.program_name || assignment.program_id}
                        role={roleLabel(assignment.role || assignment.title)}
                        href={assignment.href}
                      />
                    ))}
                    {contexts.program_participations.map((participation, index) => (
                      <ContextCard
                        key={`part-${participation.program_id}-${index}`}
                        title={participation.program_name || participation.program_id}
                        role={roleLabel("participant")}
                        href={participation.href}
                        completed={participation.completed}
                      />
                    ))}
                  </Group>
                )}

                {/* Ventures — existing memberships (labeled Venture, not Participant) */}
                {contexts.venture_memberships.length > 0 && (
                  <Group icon={Rocket} label={t("common.workspaces.groupVentures")}>
                    {contexts.venture_memberships.map((membership, index) => (
                      <ContextCard
                        key={`venture-${membership.venture_id}-${index}`}
                        title={t("common.workspaces.roleVenture")}
                        href={membership.href}
                      />
                    ))}
                  </Group>
                )}
              </div>
            ) : hasLegacy ? (
              <div className="grid gap-3">
                {data.workspaces.map((workspace, index) => (
                  <ContextCard
                    key={`${workspace.program_id}-${index}`}
                    title={workspace.program_name}
                    role={`${t("common.workspaces.role")}: ${workspace.title}`}
                    href={workspace.href}
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
