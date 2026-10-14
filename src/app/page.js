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
  BookOpen,
  Rocket,
  Users,
  BarChart3,
  TrendingUp,
  Star,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import { useI18n, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { roleHomeHref } from "@/models/platform/roles";

// Six capability pillars. Colours come from the charter palette — every
// Tailwind family is remapped in tailwind.config.js — never a bespoke hex.
const PILLARS = [
  { key: "programs",   icon: BookOpen,   text: "text-brand-orange", soft: "bg-brand-orange/10", bar: "bg-brand-orange" },
  { key: "ventures",   icon: Rocket,     text: "text-violet-400",   soft: "bg-violet-500/10",   bar: "bg-violet-500" },
  { key: "mentorship", icon: Users,      text: "text-sky-300",      soft: "bg-sky-400/10",      bar: "bg-sky-400" },
  { key: "progress",   icon: BarChart3,  text: "text-emerald-400",  soft: "bg-emerald-500/10",  bar: "bg-emerald-500" },
  { key: "funding",    icon: TrendingUp, text: "text-amber-400",    soft: "bg-amber-500/10",    bar: "bg-amber-500" },
  { key: "impact",     icon: Star,       text: "text-rose-400",     soft: "bg-rose-500/10",     bar: "bg-rose-500" },
];

// ─── Stored session store ──────────────────────────────────────────────────
const subscribeNever   = () => () => {};
const unknownOnServer  = () => undefined;
const readStoredUser   = () => { try { return localStorage.getItem("user");       } catch { return null; } };
const readStoredSession= () => { try { return localStorage.getItem("sa_session"); } catch { return null; } };

function readUser(raw) {
  try { return JSON.parse(raw || "null"); } catch { return null; }
}

export default function HomePage() {
  const router = useRouter();
  const { t, lang, switchLang } = useI18n();
  const { resolvedTheme, toggleTheme, mounted } = useTheme();

  const storedUser    = useSyncExternalStore(subscribeNever, readStoredUser,    unknownOnServer);
  const storedSession = useSyncExternalStore(subscribeNever, readStoredSession, unknownOnServer);

  const resolved = storedUser !== undefined && storedSession !== undefined;
  const user     = resolved ? readUser(storedUser) : null;

  useEffect(() => {
    if (storedSession === undefined || storedUser === undefined) return;
    if (storedSession === "prime-2026-active") { router.replace("/admin"); return; }
    const user = readUser(storedUser);
    if (user) router.replace(user.home || roleHomeHref(user.role) || "/workspaces");
  }, [storedUser, storedSession, router]);

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

      {/* ── Ambient background gradients ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* Top warm glow */}
        <div
          className="absolute inset-x-0 top-0 h-[65vh]"
          style={{ background: "radial-gradient(55% 55% at 50% -5%, rgb(255 102 0 / 0.18), transparent 70%)" }}
        />
        {/* Bottom cool glow */}
        <div
          className="absolute inset-x-0 bottom-0 h-[45vh]"
          style={{ background: "radial-gradient(50% 60% at 50% 110%, rgb(0 102 255 / 0.10), transparent 70%)" }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Top bar ── */}
      <header className="relative z-10 w-full px-6 py-5 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-divider/60 bg-surface-1">
              <Image
                src="/brand/logo_full.png"
                alt="Future Studio"
                width={120}
                height={120}
                priority
                className="h-7 w-7 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-black tracking-tight text-[var(--text-primary)]">ImpactOS</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--text-secondary)]">
                {t("rootMisc.landing.kicker")}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <div className="flex items-center gap-1 rounded-full border border-divider/60 bg-surface-1 px-2 py-1">
              <Globe className="h-3 w-3 text-[var(--text-secondary)]" />
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => switchLang(language.code)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                    lang === language.code
                      ? "bg-[var(--brand-orange)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {language.nativeLabel}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
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
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 pb-20 text-center sm:pt-24 sm:pb-24">
        <div className="w-full max-w-3xl">

          {/* Eyebrow badge */}
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/8 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--brand-orange)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-orange)]" />
            {t("rootMisc.landing.kicker")}
          </span>

          {/* Headline */}
          <h1
            className="mx-auto mt-7 text-[2.75rem] font-black leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)] sm:text-[4rem]"
            style={{ textWrap: "balance" }}
          >
            {t("rootMisc.landing.title")}
          </h1>

          {/* Sub-headline */}
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-[1.0625rem]">
            {t("rootMisc.landing.intro")}
          </p>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2.5 rounded-2xl bg-[var(--brand-orange)] px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:shadow-orange-600/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              {t("rootMisc.landing.signIn")}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="text-[11px] font-medium text-[var(--text-tertiary)]">
              {t("rootMisc.landing.signInHint")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Divider line with label ── */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 sm:px-10">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-divider/60" />
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.35em] text-[var(--text-secondary)] opacity-60">
            {t("rootMisc.landing.whatTitle")}
          </span>
          <div className="h-px flex-1 bg-divider/60" />
        </div>
      </div>

      {/* ── 6-pillar grid ── */}
      <section className="relative z-10 w-full px-6 py-12 sm:px-10 sm:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map(({ key, icon: Icon, text, soft, bar }, idx) => (
              <div
                key={key}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-divider/60 bg-surface-1 p-6 transition-all hover:border-divider hover:bg-surface-2 hover:-translate-y-0.5"
              >
                {/* Subtle corner accent */}
                <div
                  className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20 ${bar}`}
                />

                {/* Number + Icon row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${soft} ${text}`}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-[0.25em] tabular-nums opacity-50 ${text}`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Text */}
                <div>
                  <h3 className="text-[12px] font-black uppercase tracking-[0.08em] text-[var(--text-primary)]">
                    {t(`rootMisc.landing.pillars.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {t(`rootMisc.landing.pillars.${key}.body`)}
                  </p>
                </div>

                {/* Bottom accent line */}
                <div
                  className={`absolute bottom-0 left-0 h-[2px] w-0 rounded-b-2xl transition-all duration-300 group-hover:w-full ${bar}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 mt-auto w-full border-t border-divider/60 px-6 py-5 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">
            {t("rootMisc.landing.footer")}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--text-secondary)] opacity-50">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-orange)] opacity-70" />
            ImpactOS
          </div>
        </div>
      </footer>
    </main>
  );
}
