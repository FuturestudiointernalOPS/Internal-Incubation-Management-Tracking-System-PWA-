"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";

/**
 * VENTURE HANDBOOK — a button at the top of the venture space, opening the
 * manual as a popup, with a search over every page of it.
 *
 * It sits inside the venture, not in the global sidebar: the handbook is about
 * THIS venture's workspace, and a Venture Manager reads it between two tasks and
 * then carries on. Opening it is a modal — no navigation away, no download.
 *
 * Every sentence comes from `venture.handbook.*`, so it is translated like the
 * rest of the interface. It reads no data and writes nothing.
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

/** Case- and accent-insensitive, so "séance" is found by typing "seance". */
const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function HandbookButton({ className = "" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(PAGES[0]);
  const [query, setQuery] = useState("");

  const title = (key) => t(`venture.handbook.page.${key}.title`);

  const results = useMemo(() => {
    // `t` is the only outside dependency on purpose: switching language
    // rebuilds the index. The haystack is built here so listing it would be
    // meaningless — it closes over `t`, not over the query.
    const haystack = (key) =>
      normalize(
        [
          t(`venture.handbook.page.${key}.title`),
          t(`venture.handbook.page.${key}.summary`),
          t(`venture.handbook.page.${key}.body`),
          t(`venture.handbook.page.${key}.bullets`),
        ].join(" "),
      );
    const term = normalize(query.trim());
    if (!term) return PAGES;
    return PAGES.filter((key) => haystack(key).includes(term));
  }, [query, t]);

  // The page on screen is derived, never stored: typing a word that filters the
  // open page out selects the first match, and clearing the search brings the
  // whole contents back.
  const current = results.includes(active) ? active : results[0];

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`stf-btn sm ${className}`}
        title={t("venture.handbook.title")}
      >
        <BookOpen size={13} /> {t("venture.handbook.button")}
      </button>

      <AppModal isOpen={open} onClose={close} title={t("venture.handbook.title")} size="xl">
        <div className="space-y-4">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.handbook.intro")}
          </p>

          {/* Search — the whole manual, by keyword */}
          <div>
            <label className="relative block">
              <Search
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-tertiary)" }}
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && results[0]) setActive(results[0]);
                }}
                placeholder={t("venture.handbook.searchPlaceholder")}
                aria-label={t("venture.handbook.searchPlaceholder")}
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </label>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              {t("venture.handbook.searchCount", { count: results.length })}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,210px)_minmax(0,1fr)] items-start">
            {/* Contents, filtered live */}
            <nav aria-label={t("venture.handbook.contents")} className="order-2 md:order-1">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--text-secondary)" }}>
                {t("venture.handbook.contents")}
              </p>
              <ul className="space-y-0.5 max-h-[45vh] overflow-y-auto pr-1">
                {results.map((key) => {
                  const selected = key === current;
                  const position = PAGES.indexOf(key) + 1;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setActive(key)}
                        aria-current={selected ? "page" : undefined}
                        className="w-full text-left rounded-lg px-2 py-1.5 flex items-baseline gap-2 text-xs"
                        style={{
                          background: selected ? "var(--surface-3)" : "transparent",
                          color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: selected ? 700 : 500,
                        }}
                      >
                        <span className="text-[9px] tabular-nums shrink-0" style={{ color: "var(--text-tertiary)" }}>
                          {String(position).padStart(2, "0")}
                        </span>
                        <span className="truncate">{title(key)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* The page itself */}
            <article className="order-1 md:order-2 space-y-3 min-h-[220px]">
              {!current ? (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.handbook.searchEmpty")}
                </p>
              ) : (
                <>
                  <header className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--brand-orange)" }}>
                      {t("venture.handbook.pageLabel", { n: PAGES.indexOf(current) + 1 })}
                    </p>
                    <h2 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
                      {title(current)}
                    </h2>
                    <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>
                      {t(`venture.handbook.page.${current}.summary`)}
                    </p>
                  </header>

                  {paragraphs(t(`venture.handbook.page.${current}.body`)).map((paragraph, position) => (
                    <p key={position} className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                      {paragraph}
                    </p>
                  ))}

                  {bulletLines(t(`venture.handbook.page.${current}.bullets`)).length > 0 && (
                    <ul className="space-y-2">
                      {bulletLines(t(`venture.handbook.page.${current}.bullets`)).map((line, position) => (
                        <li key={position} className="flex gap-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--brand-orange)" }} />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={close}
                    className="text-[10px] font-bold uppercase tracking-widest pt-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("venture.handbook.close")}
                  </button>
                </>
              )}
            </article>
          </div>
        </div>
      </AppModal>
    </>
  );
}
