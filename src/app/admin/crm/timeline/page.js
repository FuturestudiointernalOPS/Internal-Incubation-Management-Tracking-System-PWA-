"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Clock, Filter, User, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import { useSafeBack } from "@/lib/useSafeBack";

const MODULE_COLORS = {
  forms: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  programs: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ventures: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  investors: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  communications: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  crm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  system: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const ROLE_LABELS = {
  participant: "crm.roles.participant",
  staff: "crm.roles.staff",
  teacher: "crm.roles.teacher",
  investor: "crm.roles.investor",
  finance: "crm.roles.finance",
  developer: "crm.roles.developer",
  unassigned: "crm.roles.unassigned",
  team: "crm.roles.team",
  founder: "crm.roles.founder",
  pm: "crm.roles.pm",
};

const MODULE_LABELS = {
  forms: "crm.modules.forms",
  programs: "crm.modules.programs",
  ventures: "crm.modules.ventures",
  investors: "crm.modules.investors",
  communications: "crm.modules.communications",
  system: "crm.modules.system",
};

function TimelinePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cid = searchParams.get("cid");
  const { t, lang } = useI18n();
  const goBack = useSafeBack("/admin/crm");

  const [contact, setContact] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!cid) return;
    async function fetchTimeline() {
      setLoading(true);
      try {
        const url = `/api/contacts/${cid}/timeline?limit=100${moduleFilter ? `&module=${moduleFilter}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setContact(data.contact);
          setEvents(data.events || []);
        }
      } catch (e) {
        console.error("Timeline fetch error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, [cid, moduleFilter]);

  async function handleContactSearch(q) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.contacts || []);
    } catch (_) {}
    setSearching(false);
  }

  const eventsByYear = {};
  for (const ev of events) {
    const year = new Date(ev.created_at).getFullYear();
    if (!eventsByYear[year]) eventsByYear[year] = [];
    eventsByYear[year].push(ev);
  }
  const sortedYears = Object.keys(eventsByYear).sort((a, b) => b - a);

  if (!cid) {
    return (
      <>
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-10 text-center">
            <Clock className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
            <h2 className="text-lg font-black uppercase mb-2">{t("crm.timeline.selectContact")}</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              {t("crm.timeline.selectContactHint")}
            </p>
            <div className="max-w-md mx-auto mb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder={t("crm.timeline.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => handleContactSearch(e.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 bg-tertiary border border-[var(--border-primary)] rounded-xl overflow-hidden text-left">
                  {searchResults.map((c) => (
                    <button
                      key={c.cid}
                      onClick={() => router.push(`/admin/crm/timeline?cid=${c.cid}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary transition-colors text-left"
                    >
                      <User className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                      <div>
                        <p className="text-sm font-bold">{c.name}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{c.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searching && <p className="text-[10px] text-[var(--text-secondary)] mt-2">{t("crm.timeline.searching")}</p>}
            </div>
            <Link
              href="/admin/crm"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl"
            >
              {t("crm.timeline.backToCrm")}
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("crm.backToPrevious")}
            </button>
            <Link href="/admin/crm" className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] mt-2">
              ← {t("crm.timeline.breadcrumbCrm")}
            </Link>
            <h1 className="text-xl font-black uppercase tracking-tight mt-1">
              {contact ? contact.name : t("crm.timeline.timelineTitle")}
            </h1>
            {contact && (
              <p className="text-xs text-[var(--text-secondary)]">
                {contact.email} · {t(ROLE_LABELS[contact.role] || "") || contact.role || t("crm.timeline.unassigned")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: "", label: t("crm.timeline.filterAll") },
            { key: "forms", label: t("crm.timeline.filterForms") },
            { key: "programs", label: t("crm.timeline.filterPrograms") },
            { key: "ventures", label: t("crm.timeline.filterVentures") },
            { key: "investors", label: t("crm.timeline.filterInvestors") },
            { key: "communications", label: t("crm.timeline.filterComms") },
            { key: "system", label: t("crm.timeline.filterSystem") },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setModuleFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-colors ${
                moduleFilter === f.key
                  ? "bg-[var(--brand-orange)] text-black border-orange-600"
                  : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-10">
            <p className="text-sm text-[var(--text-secondary)]">{t("crm.timeline.loadingTimeline")}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-10 text-center">
            <Clock className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)]" />
            <p className="text-sm font-bold mb-1">{t("crm.timeline.noEventsYet")}</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {t("crm.timeline.emptyStateHint", { name: contact?.name || t("crm.timeline.thisPerson") })}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedYears.map((year) => (
              <div key={year}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-3 h-3 rounded-full bg-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-[var(--brand-orange)]">
                    {year}
                  </h2>
                </div>
                <div className="space-y-2 pl-6 border-l-2 border-[var(--border-primary)]">
                  {eventsByYear[year].map((ev) => (
                    <div key={ev.id} className="relative pl-6 pb-4">
                      <div className="absolute left-[-23px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--border-primary)] border-2 border-primary" />
                      <div className="bg-primary border border-[var(--border-primary)] rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold">{ev.description}</p>
                          {ev.context_module && (
                            <span className={`shrink-0 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${MODULE_COLORS[ev.context_module] || MODULE_COLORS.system}`}>
                              {t(MODULE_LABELS[ev.context_module] || "") || ev.context_module}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">
                          {formatLocaleDate(ev.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-[var(--text-secondary)] text-center italic">
          {t("crm.timeline.phaseNote")}
        </p>
      </div>
    </>
  );
}

export default function TimelinePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">{t("crm.timeline.loading")}</div>}>
      <TimelinePageContent />
    </Suspense>
  );
}
