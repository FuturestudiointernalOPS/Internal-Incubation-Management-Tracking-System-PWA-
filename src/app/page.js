"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Shield,
  ArrowRight,
  FolderKanban,
  Users,
  BarChart3,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import { useI18n, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { roleHomeHref } from "@/models/platform/roles";

// The three things the platform is for — the short answer to "what can I do here?".
const PILLARS = [
  { key: "programs", icon: FolderKanban },
  { key: "ventures", icon: Users },
  { key: "insight", icon: BarChart3 },
];

// ─── The stored session, as a store ──────────────────────────────────────────
//
// `localStorage` cannot be read during the render the server also produces, so
// the stored identity is exposed as a subscribable store: the server snapshot is
// `undefined` ("not known yet") and the client's own read answers right after
// hydration. This is the same shape the theme and language stores use, and it
// means no state is written from an effect.
const subscribeNever = () => () => {};
const unknownOnServer = () => undefined;
const readStoredUser = () => {
  try {
    return localStorage.getItem("user");
  } catch {
    return null;
  }
};
const readStoredSession = () => {
  try {
    return localStorage.getItem("sa_session");
  } catch {
    return null;
  }
};

/** Parses the stored account, tolerating an absent or malformed value. */
function readUser(raw) {
  try {
    return JSON.parse(raw || "null");
  } catch {
    return null;
  }
}

/**
 * The front door.
 *
 * Someone already signed in on this browser is bounced to wherever the server
 * sent them when they signed in — the landing is never shown to them. Everyone
 * else lands here: a short, calm introduction to what ImpactOS is, what it is
 * for, and the single way in.
 */
export default function HomePage() {
  const router = useRouter();
  const { t, lang, switchLang } = useI18n();
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  const storedUser = useSyncExternalStore(subscribeNever, readStoredUser, unknownOnServer);
  const storedSession = useSyncExternalStore(
    subscribeNever,
    readStoredSession,
    unknownOnServer,
  );

  const resolved = storedUser !== undefined && storedSession !== undefined;
  const user = resolved ? readUser(storedUser) : null;

  useEffect(() => {
    if (storedSession === undefined || storedUser === undefined) return;

    if (storedSession === "prime-2026-active") {
      router.replace("/admin");
      return;
    }
    const user = readUser(storedUser);
    if (user) {
      // The destination was decided by the server when this person signed in and
      // travelled with their identity, so this bounce can never contradict the
      // login redirect. The shared map is the fallback for a stored person from
      // before that answer existed.
      router.replace(user.home || roleHomeHref(user.role) || "/workspaces");
    }
  }, [storedUser, storedSession, router]);

  // Until we know whether someone is signed in — or while a stored session is
  // being bounced — show the quiet "connecting" line instead of the page.
  if (!resolved || user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-primary text-[var(--text-secondary)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <Shield className="h-10 w-10 text-[var(--brand-orange)]" />
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand-orange)]" />
            {t("rootMisc.landing.connecting")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-primary">
      {/* Soft full-bleed wash — a warm halo at the top, a cool one at the bottom */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 top-0 h-[70vh]"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgb(255 102 0 / 0.16), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[50vh]"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 100%, rgb(0 102 255 / 0.10), transparent 70%)",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="relative z-10 w-full px-6 py-6 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/logo_full.png"
              alt="Future Studio"
              width={1018}
              height={1024}
              priority
              className="h-9 w-auto object-contain"
            />
            <div className="leading-tight">
              <div className="text-[13px] font-black tracking-tight text-[var(--text-primary)]">
                ImpactOS
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--text-secondary)]">
                {t("rootMisc.landing.kicker")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => switchLang(language.code)}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                    lang === language.code
                      ? "border border-brand-orange/30 bg-brand-orange/15 text-[var(--brand-orange)]"
                      : "border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {language.nativeLabel}
                </button>
              ))}
            </div>

            {mounted && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={t("rootMisc.landing.switchTheme")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-divider/60 text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero — centered, the whole width is the page */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
        <div className="w-full max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-divider/60 bg-surface-1 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-orange)]" />
            {t("rootMisc.landing.kicker")}
          </span>

          <h1 className="mx-auto mt-7 text-4xl font-black leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-6xl">
            {t("rootMisc.landing.title")}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            {t("rootMisc.landing.intro")}
          </p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/login"
              className="btn btn-primary px-8 py-4 text-xs uppercase tracking-widest"
            >
              {t("rootMisc.landing.signIn")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <p className="text-[11px] font-medium text-[var(--text-tertiary)]">
              {t("rootMisc.landing.signInHint")}
            </p>
          </div>
        </div>
      </section>

      {/* What you can do here — one centered row */}
      <section className="relative z-10 w-full px-6 pb-20 sm:px-10 sm:pb-24">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            {t("rootMisc.landing.whatTitle")}
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {PILLARS.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="flex flex-col items-center rounded-[16px] border border-divider/60 bg-surface-1 p-6 text-center transition-colors hover:border-brand-orange/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-orange/10 text-[var(--brand-orange)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[12px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                  {t(`rootMisc.landing.pillars.${key}.title`)}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {t(`rootMisc.landing.pillars.${key}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-divider/60 px-6 py-6 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
            {t("rootMisc.landing.footer")}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--text-secondary)] opacity-60">
            {t("rootMisc.landing.kicker")}
          </p>
        </div>
      </footer>
    </main>
  );
}
