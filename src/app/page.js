"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Globe,
  GraduationCap,
  Handshake,
  Loader2,
  Moon,
  Rocket,
  Shield,
  Sun,
} from "lucide-react";
import { useI18n, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { roleHomeHref } from "@/models/platform/roles";

// The five products, in the order the page presents them. Only the key is
// authored here: every word comes from the locale files.
const PRODUCTS = [
  { key: "operations", icon: CalendarCheck },
  { key: "programs", icon: BookOpen },
  { key: "learning", icon: GraduationCap },
  { key: "ventures", icon: Rocket },
  { key: "investors", icon: Handshake },
];

const CONTACT_EMAIL = "info@futurestudio.bj";

// ─── Stored session, read as a store ─────────────────────────────────────────
// The browser's copy is only used to DECIDE WHAT TO PAINT while the server is
// asked; it never authorises anything (the server's answer does).
const subscribeNever = () => () => {};
const unknownOnServer = () => undefined;
const readStoredUser = () => {
  try {
    return localStorage.getItem("user");
  } catch {
    return null;
  }
};

function readUser(raw) {
  try {
    return JSON.parse(raw || "null");
  } catch {
    return null;
  }
}

function ConnectingScreen({ label }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary text-[var(--text-secondary)]">
      <div className="flex flex-col items-center gap-4 text-center">
        <Shield className="h-10 w-10 text-[var(--brand-orange)]" aria-hidden="true" />
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--brand-orange)]" aria-hidden="true" />
          {label}
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { t, lang, switchLang } = useI18n();
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  const storedUser = useSyncExternalStore(subscribeNever, readStoredUser, unknownOnServer);
  const resolved = storedUser !== undefined;
  const hasStoredUser = resolved && Boolean(readUser(storedUser));

  // "checking" until the server has answered. The answer decides everything:
  // a valid session is sent to its home, and anything else stays here.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await response.json();

        if (!cancelled && data?.authenticated && data.user) {
          // Refresh the stored copy with the server's answer — a role or a home
          // that changed server-side must not keep coming back from stale
          // storage on the next visit. The destination the sign-in computed is
          // kept, because the session check does not repeat that work.
          let user = data.user;
          try {
            const cached = readUser(localStorage.getItem("user"));
            if (cached) {
              user = { ...cached, ...data.user, home: cached.home || data.user.home };
              localStorage.setItem("user", JSON.stringify(user));
            }
          } catch {
            // A browser with storage disabled still gets its destination below.
          }
          router.replace(user.home || roleHomeHref(user.role) || "/member");
          return; // keep the connecting screen while the navigation starts
        }

        // A definitive "no valid session": drop the stored copy so no other
        // screen can treat this person as signed in.
        if (!cancelled) {
          try {
            localStorage.removeItem("user");
          } catch {
            // Nothing to clean up when storage is unavailable.
          }
        }
      } catch {
        // The server could not be asked (offline, restarting). Do not evict the
        // stored copy on a network hiccup — just show the landing page.
      }

      if (!cancelled) setChecked(true);
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Server render and hydration wait for the browser's copy (no landing flash
  // for a signed-in visitor), and a returning visitor waits for the server's
  // verdict before the landing page is painted.
  if (!resolved || (hasStoredUser && !checked)) {
    return <ConnectingScreen label={t("rootMisc.landing.connecting")} />;
  }

  const problemLines = [
    t("rootMisc.landing.problem.line1"),
    t("rootMisc.landing.problem.line2"),
    t("rootMisc.landing.problem.line3"),
    t("rootMisc.landing.problem.line4"),
  ];

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-primary text-[var(--text-primary)]">
      {/* ── Ambient background ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-brand-orange/10 blur-3xl" />
        <div className="absolute -bottom-52 right-0 h-[30rem] w-[30rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-[24rem] w-[24rem] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 w-full px-5 py-4 sm:px-10 sm:py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-divider/60 bg-surface-1">
              <Image
                src="/brand/logo_full.png"
                alt="Future Studio"
                width={120}
                height={120}
                priority
                className="h-8 w-8 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-black tracking-tight text-[var(--text-primary)]">
                {t("rootMisc.landing.brand")}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.26em] text-[var(--text-secondary)]">
                {t("rootMisc.landing.brandBy")}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {/* Language */}
              <div className="flex items-center gap-1 rounded-full border border-divider/60 bg-surface-1 px-1.5 py-1">
                <Globe className="ml-1 h-3 w-3 text-[var(--text-secondary)]" aria-hidden="true" />
                {SUPPORTED_LANGUAGES.map((language, index) => (
                  <React.Fragment key={language.code}>
                    {index > 0 && <span aria-hidden="true" className="h-3 w-px bg-divider/70" />}
                    <button
                      type="button"
                      onClick={() => switchLang(language.code)}
                      aria-pressed={lang === language.code}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        lang === language.code
                          ? "bg-[var(--brand-orange)] text-white"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {language.nativeLabel}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Theme */}
              {mounted && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={t("rootMisc.landing.switchTheme")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-divider/60 bg-surface-1 text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
                >
                  {resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              )}

              {/* Sign in */}
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-xl bg-[var(--brand-orange)] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:bg-orange-600 active:translate-y-0"
              >
                {t("rootMisc.landing.signIn")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <p className="max-w-xs text-[10.5px] leading-snug text-[var(--text-tertiary)] sm:text-right">
              {t("rootMisc.landing.signInHint")}
            </p>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center px-5 pb-16 pt-12 text-center sm:px-10 sm:pb-24 sm:pt-20">
        <div className="w-full max-w-4xl">
          <h1
            className="mx-auto max-w-3xl text-[2.5rem] font-black leading-[1.06] tracking-[-0.03em] text-[var(--text-primary)] sm:text-[3.75rem]"
            style={{ textWrap: "balance" }}
          >
            {t("rootMisc.landing.hero.titleLead")}{" "}
            <span className="text-[var(--brand-orange)]">{t("rootMisc.landing.hero.titleAccent")}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            {t("rootMisc.landing.hero.intro")}
          </p>

          <div className="mt-9 flex flex-col items-center">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="group inline-flex items-center gap-2.5 rounded-2xl bg-[var(--brand-orange)] px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-orange-600 active:translate-y-0"
            >
              {t("rootMisc.landing.hero.talkToUs")}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── The problem (no visible section label) ── */}
      <section className="relative z-10 w-full px-5 py-8 sm:px-10 sm:py-12">
        <div className="mx-auto w-full max-w-4xl">
          <div className="space-y-4 border-l-2 border-brand-orange/50 pl-5 sm:pl-7">
            {problemLines.map((line, index) => (
              <p
                key={index}
                className={
                  index === 2
                    ? "text-base font-semibold leading-relaxed text-[var(--text-primary)] sm:text-lg"
                    : "text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg"
                }
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── What ImpactOS is (no visible section label) ── */}
      <section className="relative z-10 w-full px-5 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {t("rootMisc.landing.is.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            {t("rootMisc.landing.is.body")}
          </p>
        </div>
      </section>

      {/* ── What it offers (no visible section label) ── */}
      <section className="relative z-10 w-full px-5 sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {PRODUCTS.map(({ key, icon: Icon }, index) => (
            <article
              key={key}
              className={`group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-divider/60 bg-surface-1 p-6 transition-all hover:-translate-y-0.5 hover:border-brand-orange/40 hover:bg-surface-2 ${
                index < 2 ? "lg:col-span-3" : "lg:col-span-2"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange/10 text-[var(--brand-orange)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] tabular-nums text-[var(--text-tertiary)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <div>
                <h3 className="text-[12px] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                  {t(`rootMisc.landing.products.${key}.title`)}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {t(`rootMisc.landing.products.${key}.body`)}
                </p>
              </div>

              <div className="absolute bottom-0 left-0 h-[2px] w-0 rounded-b-2xl bg-[var(--brand-orange)] transition-all duration-300 group-hover:w-full" />
            </article>
          ))}
        </div>
      </section>

      {/* ── In short (closing invitation) ── */}
      <section className="relative z-10 w-full px-5 py-16 sm:px-10 sm:py-20">
        <div className="mx-auto w-full max-w-4xl">
          <div className="relative overflow-hidden rounded-2xl border border-brand-orange/30 bg-surface-1 px-6 py-10 shadow-[var(--card-shadow)] sm:px-10 sm:py-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl"
            />
            <div className="relative">
              <p className="text-xl font-black leading-snug tracking-tight text-[var(--text-primary)] sm:text-2xl">
                {t("rootMisc.landing.short.tagline")}
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                {t("rootMisc.landing.short.body")}
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {t("rootMisc.landing.short.question")}
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="group inline-flex items-center gap-2 rounded-xl bg-[var(--brand-orange)] px-6 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:bg-orange-600 active:translate-y-0"
                >
                  {t("rootMisc.landing.short.talkToUs")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 mt-auto w-full border-t border-divider/60 px-5 py-5 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
            {t("rootMisc.landing.footer")}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)] opacity-60">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-orange)]" />
            {t("rootMisc.landing.brand")}
          </div>
        </div>
      </footer>
    </main>
  );
}
