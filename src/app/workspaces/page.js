"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { LayoutGrid, LogOut, Loader2, ArrowRight, User } from "lucide-react";

/**
 * WORKSPACES HUB
 * Neutral post-login landing page. Lists the authenticated user's active
 * assignments (derived server-side) and links to the fallback role dashboard.
 * A user with no assignments sees an empty state — having no assignment is a
 * valid platform state.
 */

export default function WorkspacesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.success) setData(d);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (_) {}
    localStorage.clear();
    router.replace("/login");
  };

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

            {data?.workspaces?.length > 0 ? (
              <div className="grid gap-3">
                {data.workspaces.map((w, i) => (
                  <Link
                    key={`${w.program_id}-${i}`}
                    href={w.href}
                    className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border-primary)] bg-secondary hover:border-[var(--brand-orange)] transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-black uppercase truncate text-[var(--text-primary)]">
                        {w.program_name}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-1">
                        {t("common.workspaces.role")}: {w.title}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] shrink-0">
                      {t("common.workspaces.open")}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
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
