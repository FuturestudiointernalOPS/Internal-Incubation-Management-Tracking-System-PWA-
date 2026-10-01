"use client";

/**
 * AUDIT VIEW — extracted from `PermissionCenter.js`, with its own vocabulary and
 * its own presentational helper.
 *
 * The audit reader: paginated history, a filter panel over the six fields the
 * endpoint supports, and a detail drawer that explains WHY an entry exists
 * rather than only recording it. `AUDIT_ACTIONS` and `AUDIT_FILTER_DEFAULTS`
 * belong to this screen: the action list feeds its own filter dropdown, and the
 * defaults seed BOTH the typing state and the applied state. They are not shared
 * with anything, and they stay here because splitting them out would have meant
 * moving two things that only this screen reads together.
 *
 * `Field` travels for the same reason — a two-line label/value row used only by
 * this detail panel. Deliberately NOT exported: it is a private detail of this
 * screen, and exporting it would invite reuse without anyone having checked
 * that this screen's needs are the right ones.
 *
 * Split out verbatim, behaviour identical.
 */

import { useEffect, useState } from "react";
import AuditPersonFilter from "@/components/permissions/AuditPersonFilter";
import { splitAuditReason } from "@/components/permissions/auditHelpers";
import { defer } from "@/components/permissions/effectUtils";
import Badge from "@/components/permissions/ui/Badge";
import WhyDrawer from "@/components/permissions/ui/WhyDrawer";
import AppPagination from "@/components/ui/AppPagination";
import { CAPABILITY_CATALOG } from "@/lib/authorization/capability-catalog";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { Clock } from "lucide-react";

/* ─── Phase 7: Permission Audit viewer ───────────────────────────────────── */

const AUDIT_ACTIONS = [
  "granted",
  "revoked",
  "restricted",
  "unrestricted",
  "eligibility_changed",
  "profile_created",
  "profile_updated",
  "profile_deleted",
  "role_default_changed",
  "access_profile_changed",
  "membership_changed",
  "role_changed",
];

const AUDIT_FILTER_DEFAULTS = {
  q: "",
  actor: "",
  target: "",
  action: "",
  module: "",
  capability: "",
  target_cid: "",
  from: "",
  to: "",
};

export default function AuditView() {
  const { t } = useI18n();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Every filter the audit endpoint supports and the screen exposes. `applied`
  // is what has been SENT (the fetch depends on it), `filters` is what the admin
  // is typing — so a half-typed name never issues a request.
  const [filters, setFilters] = useState(AUDIT_FILTER_DEFAULTS);
  const [applied, setApplied] = useState(AUDIT_FILTER_DEFAULTS);
  const [detail, setDetail] = useState(null);
  // The fetch waits for the URL read below: a ?target_cid= deep link must be
  // part of the FIRST request, not a second one after an unfiltered paint.
  const [ready, setReady] = useState(false);

  // Deep link from the person screen: "show me THIS person's whole history".
  // Deferred (project convention: an effect performs no synchronous state
  // write), and reading the URL is not part of the authorization decision — the
  // server filters and authorizes the same request either way.
  useEffect(() => {
    defer(() => {
      const seeded = { ...AUDIT_FILTER_DEFAULTS };
      try {
        const params = new URLSearchParams(window.location.search);
        for (const key of Object.keys(AUDIT_FILTER_DEFAULTS)) {
          const value = params.get(key);
          if (value) seeded[key] = value;
        }
      } catch {
        /* no deep link — start unfiltered */
      }
      setFilters(seeded);
      setApplied(seeded);
      setReady(true);
    });
  }, []);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const applyFilters = () => setApplied(filters);

  const clearFilters = () => {
    setFilters({ ...AUDIT_FILTER_DEFAULTS });
    setApplied({ ...AUDIT_FILTER_DEFAULTS });
    setPage(1);
  };

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    for (const [key, value] of Object.entries(applied)) {
      if (value) params.set(key, value);
    }
    const url = `/api/engineering/permissions/audit?${params.toString()}`;
    const apply = (data) => {
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    };
    (async () => {
      setLoading(true);
      setError("");
      let painted = false;
      // Cache-first paint: returning to this page / paging back renders
      // instantly from fresh snapshots keyed by page + applied filters.
      const cached = cacheGet(url);
      if (cached !== null && cached.success) {
        apply(cached);
        setLoading(false);
        painted = true;
      }
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          if (data.success) {
            cacheSet(url, data);
            apply(data);
          } else if (!painted) {
            setError(data.error || "—");
          }
        }
      } catch {
        if (!cancelled && !painted) setError("—");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applied, page, pageSize, ready]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const moduleOptions = Object.keys(CAPABILITY_CATALOG).sort();

  const fmtDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters: the free-text box searches everything at once; the fields next
          to it answer the narrower, more common questions — who made the change,
          who it was about, which capability, and one person's whole history. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <input
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && applyFilters()}
            placeholder={t("engineering.permissions.auditSearch")}
            aria-label={t("engineering.permissions.auditSearch")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40 transition-all"
          />
        </div>
        <input
          value={filters.actor}
          onChange={(event) => updateFilter("actor", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterActor")}
          aria-label={t("engineering.permissions.auditFilterActor")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <input
          value={filters.target}
          onChange={(event) => updateFilter("target", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterTarget")}
          aria-label={t("engineering.permissions.auditFilterTarget")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <input
          value={filters.capability}
          onChange={(event) => updateFilter("capability", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterCapability")}
          aria-label={t("engineering.permissions.auditFilterCapability")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <select
          value={filters.action}
          onChange={(event) => updateFilter("action", event.target.value)}
          aria-label={t("engineering.permissions.auditFilterActionAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        >
          <option value="">{t("engineering.permissions.auditAllActions")}</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <select
          value={filters.module}
          onChange={(event) => updateFilter("module", event.target.value)}
          aria-label={t("engineering.permissions.auditFilterModuleAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        >
          <option value="">{t("engineering.permissions.auditAllModules")}</option>
          {moduleOptions.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>
        <AuditPersonFilter
          value={filters.target_cid}
          onChange={(cid) => updateFilter("target_cid", cid)}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.auditFilterFrom")}
          </span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter("from", event.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.auditFilterTo")}
          </span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter("to", event.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          />
        </label>
        <button
          onClick={applyFilters}
          className="px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {t("engineering.permissions.auditApplyFilters")}
        </button>
        <button
          onClick={clearFilters}
          className="px-4 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {t("engineering.permissions.auditClearFilters")}
        </button>
      </div>

      {applied.target_cid && (
        <p className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-3 py-2 text-[10px] font-bold text-[var(--text-primary)]">
          {t("engineering.permissions.auditFilterPersonActive")}
        </p>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[10px] font-bold text-red-400">{error}</p>
        </div>
      )}

      <div
        className="ios-card !p-0 border-[var(--border-primary)] overflow-hidden"
      >
        <div className="px-5 py-3 bg-secondary border-b border-[var(--border-primary)] flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
            {t("engineering.permissions.auditTotal", { total })}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
            {t("engineering.permissions.auditReadOnly")}
          </p>
        </div>
        {loading ? (
          <div className="p-8 space-y-3">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--surface-3)" }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center opacity-50">
            <Clock className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-[10px] font-black text-[var(--text-primary)] uppercase">
              {t("engineering.permissions.auditNoResults")}
            </p>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditDate")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditActor")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditTarget")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditAction")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditObject")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.auditChange")}</th>
                  <th className="px-4 py-2.5">{t("engineering.permissions.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-divider/50 last:border-b-0 hover:bg-tertiary/20 transition-all">
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
                      {fmtDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.actor_name || entry.actor_cid || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.target_name || entry.target_cid || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)]">
                      {entry.module ? `${entry.module}.${entry.capability || "*"}` : entry.details ? String(entry.details).slice(0, 48) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
                      {entry.previous_value || entry.new_value ? (
                        <span>
                          <span className="text-slate-500 line-through">{entry.previous_value || "—"}</span>
                          {" → "}
                          <span className="text-emerald-400">{entry.new_value || "—"}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setDetail(entry)}
                        className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                      >
                        {t("engineering.permissions.auditViewDetail")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Small screens: one card per record — same fields, same drawer. */}
          <div className="md:hidden divide-y divide-divider/50">
            {entries.map((entry) => (
              <div key={entry.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400">
                    {entry.action}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                    {fmtDate(entry.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditActor")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.actor_name || entry.actor_cid || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditTarget")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {entry.target_name || entry.target_cid || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditObject")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {entry.module
                        ? `${entry.module}.${entry.capability || "*"}`
                        : entry.details
                          ? String(entry.details).slice(0, 48)
                          : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("engineering.permissions.auditChange")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                      {entry.previous_value || entry.new_value ? (
                        <span>
                          <span className="text-slate-500 line-through">
                            {entry.previous_value || "—"}
                          </span>
                          {" → "}
                          <span className="text-emerald-400">{entry.new_value || "—"}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetail(entry)}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all"
                >
                  {t("engineering.permissions.auditViewDetail")}
                </button>
              </div>
            ))}
          </div>
          </>
        )}
        {!loading && entries.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--border-primary)]">
            <AppPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Detail drawer — read-only; the audit reason gets its own field */}
      {detail && (
        <WhyDrawer
          title={t("engineering.permissions.auditDetailTitle")}
          onClose={() => setDetail(null)}
        >
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{detail.action}</Badge>
            {detail.created_at && (
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                {fmtDate(detail.created_at)}
              </span>
            )}
          </div>
          {(() => {
            const parsed = splitAuditReason(detail.details);
            return (
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <Field label={t("engineering.permissions.auditActor")} value={detail.actor_name || detail.actor_cid || "—"} />
                <Field label={t("engineering.permissions.auditTarget")} value={detail.target_name || detail.target_cid || "—"} />
                <Field label={t("engineering.permissions.auditObject")} value={detail.module ? `${detail.module}.${detail.capability || "*"}` : "—"} />
                <Field
                  label={t("engineering.permissions.auditChange")}
                  value={
                    detail.previous_value || detail.new_value
                      ? `${detail.previous_value || "—"} → ${detail.new_value || "—"}`
                      : t("engineering.permissions.auditNotAvailable")
                  }
                />
                <div className="col-span-2">
                  <Field
                    label={t("engineering.permissions.auditDetails")}
                    value={parsed.text || t("engineering.permissions.auditNotAvailable")}
                  />
                </div>
                {parsed.reason && (
                  <div className="col-span-2 rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-orange)] mb-1">
                      {t("engineering.permissions.auditReason")}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)] break-words">
                      {parsed.reason}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </WhyDrawer>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-0.5">{label}</p>
      <p className="text-[10px] font-bold text-[var(--text-primary)] break-words">{value}</p>
    </div>
  );
}
