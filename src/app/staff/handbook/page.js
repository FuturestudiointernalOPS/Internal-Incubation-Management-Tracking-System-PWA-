"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * VENTURE MANAGER HANDBOOK — the reading companion to the Journey tab.
 *
 * One page of the printed manual per entry, read IN the app: no download, no PDF
 * viewer, always the current edition. Every sentence comes from the locale files
 * (`venture.handbook.*`), so the handbook is translated like the rest of the
 * interface and cannot drift into English-only.
 *
 * It reads no database and writes nothing: it is documentation, and it must
 * never become a second source of truth for a rule that lives in the product.
 */

const PAGES = [
  "what",
  "where",
  "glance",
  "vocabulary",
  "status",
  "stage",
  "milestone",
  "review",
  "deliverables",
  "activity",
  "session",
  "notes",
  "reports",
  "templates",
  "founder",
  "week",
  "troubleshooting",
  "glossary",
];

const paragraphs = (value) => String(value || "").split("\n\n").filter((part) => part.trim());
const bulletLines = (value) => String(value || "").split("\n").filter((line) => line.trim());

export default function VentureHandbookPage() {
  const { t } = useI18n();
  const [active, setActive] = useState(PAGES[0]);

  const title = (key) => t(`venture.handbook.page.${key}.title`);
  const index = PAGES.indexOf(active);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--surface-3)", color: "var(--brand-orange)" }}
        >
          <BookOpen className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>
            {t("venture.handbook.title")}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {t("venture.handbook.subtitle")}
          </p>
          <p className="text-xs mt-2 max-w-3xl" style={{ color: "var(--text-secondary)" }}>
            {t("venture.handbook.intro")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] items-start">
        {/* Contents — the pages of the manual */}
        <nav
          className="rounded-xl border p-2 lg:sticky lg:top-6"
          style={{ borderColor: "var(--border-primary)", background: "var(--surface-1)" }}
          aria-label={t("venture.handbook.contents")}
        >
          <p
            className="px-2 pt-1 pb-2 text-[10px] font-black uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("venture.handbook.contents")}
          </p>
          <ul className="space-y-0.5">
            {PAGES.map((key, position) => {
              const selected = key === active;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setActive(key)}
                    aria-current={selected ? "page" : undefined}
                    className="w-full text-left rounded-lg px-2 py-1.5 flex items-baseline gap-2 text-xs transition-colors"
                    style={{
                      background: selected ? "var(--surface-3)" : "transparent",
                      color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                      fontWeight: selected ? 700 : 500,
                    }}
                  >
                    <span className="text-[9px] tabular-nums shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {String(position + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{title(key)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* One page */}
        <article
          className="rounded-xl border p-5 space-y-4 min-h-[420px]"
          style={{ borderColor: "var(--border-primary)", background: "var(--surface-1)" }}
        >
          <header className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--brand-orange)" }}>
              {t("venture.handbook.pageLabel", { n: index + 1 })}
            </p>
            <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
              {title(active)}
            </h2>
            <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>
              {t(`venture.handbook.page.${active}.summary`)}
            </p>
          </header>

          <div className="space-y-3">
            {paragraphs(t(`venture.handbook.page.${active}.body`)).map((paragraph, position) => (
              <p key={position} className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {paragraph}
              </p>
            ))}
          </div>

          {bulletLines(t(`venture.handbook.page.${active}.bullets`)).length > 0 && (
            <ul className="space-y-2 pt-1">
              {bulletLines(t(`venture.handbook.page.${active}.bullets`)).map((line, position) => (
                <li key={position} className="flex gap-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--brand-orange)" }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Paging, the way a manual pages */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t" style={{ borderColor: "var(--border-primary)" }}>
            <button
              type="button"
              onClick={() => setActive(PAGES[Math.max(0, index - 1)])}
              disabled={index === 0}
              className="text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
              style={{ color: "var(--text-secondary)" }}
            >
              ← {title(PAGES[Math.max(0, index - 1)])}
            </button>
            <button
              type="button"
              onClick={() => setActive(PAGES[Math.min(PAGES.length - 1, index + 1)])}
              disabled={index === PAGES.length - 1}
              className="text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 text-right"
              style={{ color: "var(--brand-orange)" }}
            >
              {title(PAGES[Math.min(PAGES.length - 1, index + 1)])} →
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
