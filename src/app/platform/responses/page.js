"use client";

import { Suspense, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Eye, FileText, Filter, X, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";

const cn = (...classes) => classes.filter(Boolean).join(" ");

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickList = (listKey) => (response) => (response?.success ? response[listKey] || [] : []);

/**
 * The rows of the table: every submission of every open run, already carrying the
 * run and the form it answers.
 *
 * This used to be collected one run at a time - the full detail of each open run
 * fetched in sequence just to reach its submissions - with the table on its
 * spinner until the last one answered. The submissions now arrive in one answer.
 */
const pickResponses = (response) => {
  if (!response?.success || !Array.isArray(response.submissions)) return EMPTY_LIST;
  return response.submissions.map((submission) => {
    const scores = submission.data?._scores;
    return {
      ...submission,
      run_name: submission.run_name,
      run_id: submission.run_id,
      form_id: submission.form_id,
      overall: scores?.overall,
      ranking: scores?.ranking,
    };
  });
};

function ResponsesContent() {
  const { t } = useI18n();
  const router = useRouter();
  const goBack = useSafeBack("/platform/runs");
  const searchParams = useSearchParams();
  const formParam = searchParams.get("form_id");
  const runParam = searchParams.get("run_id");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // The runs, the forms, the table's rows and the fields of the form on show, all
  // through the shared hook: it owns the cache, the cache-first paint and the
  // discarding of a stale answer, so the page keeps no copy of its own and reads
  // its data during render.
  const { data: runs, loading: runsLoading } = useApi("/api/platform/form-runs", {
    defaultValue: EMPTY_LIST,
    transform: pickList("runs"),
  });
  const { data: forms, loading: formsLoading } = useApi("/api/platform/forms", {
    defaultValue: EMPTY_LIST,
    transform: pickList("forms"),
  });
  const { data: allSubmissions, loading: submissionsLoading } = useApi(
    "/api/platform/form-runs?responses=true",
    { defaultValue: EMPTY_LIST, transform: pickResponses },
  );

  const loading = runsLoading || formsLoading || submissionsLoading;

  // The run the address names, when it names one. Its form then decides the form
  // filter, which is what the loader used to do while it fetched that run.
  const selectedRun = runParam
    ? runs.find((run) => String(run.id) === String(runParam))
    : null;

  // ── The form on show: what the ADDRESS asks for, or the person's choice ────
  //
  // The choice is recorded WITH the address value it was made under, so arriving
  // on a different address applies that address's form, while picking (including
  // clearing) survives a redraw. Held as "the choice, if it belongs here", which
  // is what the old code did with a ref of the last applied parameter.
  const formAsked = selectedRun?.form_id != null
    ? String(selectedRun.form_id)
    : formParam
      ? String(formParam)
      : "";
  const [formChoice, setFormChoice] = useState({ asked: null, id: null });
  const chosenFormId = formChoice.asked === formAsked ? formChoice.id : null;
  const addressFormId =
    formAsked && forms.some((form) => String(form.id) === formAsked) ? formAsked : "";
  const selectedFormId = chosenFormId ?? addressFormId;
  const selectForm = (formId) => setFormChoice({ asked: formAsked, id: formId });

  // ── The columns of the form on show ─────────────────────────────────────
  const { data: formFields, loading: fieldsLoading } = useApi(
    selectedFormId ? `/api/platform/forms?id=${selectedFormId}` : null,
    { defaultValue: EMPTY_LIST, transform: pickList("fields"), deps: [selectedFormId] },
  );
  const shownFields = formFields.filter(
    (formField) => !["hidden"].includes(formField.field_type),
  );

  // Which columns are ticked: the person's choice for this form, or the first
  // three of it. Recorded against the form, so choosing a column on one form does
  // not decide the columns of another.
  const [fieldChoices, setFieldChoices] = useState({ form: null, ids: null });
  const chosenFieldIds =
    fieldChoices.form === selectedFormId ? fieldChoices.ids : null;
  const visibleFieldIds =
    chosenFieldIds ?? shownFields.slice(0, 3).map((formField) => String(formField.id));

  const toggleField = (fieldId) => {
    const normalizedId = String(fieldId);
    const nextIds = visibleFieldIds.includes(normalizedId)
      ? visibleFieldIds.filter((visibleId) => visibleId !== normalizedId)
      : [...visibleFieldIds, normalizedId];
    setFieldChoices({ form: selectedFormId, ids: nextIds });
  };

  // The rows on show. The address can name a single run, in which case only that
  // run's submissions belong here - the answer carries every open run's, so the
  // narrowing is done on the rows rather than by asking differently.
  const formFilteredSubs = useMemo(() => {
    let submissions = allSubmissions;
    if (runParam) {
      submissions = submissions.filter((submission) => String(submission.run_id) === String(runParam));
    }
    if (selectedFormId) {
      submissions = submissions.filter((submission) => String(submission.form_id) === String(selectedFormId));
    }
    return submissions;
  }, [allSubmissions, selectedFormId, runParam]);

  const filtered = formFilteredSubs
    .filter(submission => {
      if (statusFilter !== "all" && submission.status !== statusFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        const name = (submission.submitter_name || submission.submitter_id || "").toLowerCase();
        if (name.includes(query)) return true;
        const dataValues = Object.values(submission.data || {}).map(value => typeof value === "string" ? value.toLowerCase() : "").join(" ");
        return dataValues.includes(query);
      }
      return true;
    })
    .sort((first, second) => {
      const firstDate = first.submitted_at || "";
      const secondDate = second.submitted_at || "";
      return secondDate > firstDate ? 1 : secondDate < firstDate ? -1 : 0;
    });

  const submissionCounts = {
    all: formFilteredSubs.length,
    submitted: formFilteredSubs.filter(submission => submission.status === "submitted").length,
    approved: formFilteredSubs.filter(submission => submission.status === "approved").length,
    rejected: formFilteredSubs.filter(submission => submission.status === "rejected").length,
  };

  const formName = (formId) => forms.find(form => form.id === formId)?.name || "—";
  const runName = (runId) => runs.find(run => run.id === runId)?.name || "—";

  const visibleFields = shownFields.filter(formField => visibleFieldIds.includes(String(formField.id)));

  const formatCell = (value) => {
    if (value === undefined || value === null || value === "") return "—";
    const text = String(value);
    if (text.startsWith("{") && text.includes('"code"')) {
      try { const parsed = JSON.parse(text); if (parsed.code && parsed.number) return `${parsed.code} ${parsed.number}`; } catch (_) {}
    }
    return text.length > 35 ? text.substring(0, 35) + "..." : text;
  };

  const getFieldValue = (submission, field) => {
    return submission.data?.[field.label] ?? submission.data?.[String(field.id)] ?? submission.data?.[field.id];
  };

  const selectedForm = forms.find(form => String(form.id) === String(selectedFormId));

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-secondary shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors shrink-0">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("platformMisc.responses.back")}
            </button>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.responses.title")}</h1>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                {runParam
                  ? t("platformMisc.responses.submissionsForRun", { count: filtered.length, name: runName(Number(runParam)) || "—" })
                  : selectedForm
                    ? t("platformMisc.responses.submissionsForForm", { count: filtered.length, name: selectedForm.name })
                    : t("platformMisc.responses.submissionsAcrossRuns", { count: allSubmissions.length, runs: runs.filter(run => !["draft","cancelled"].includes(run.status)).length })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Run-specific view: fixed run badge instead of the selector */}
          {runParam ? (
            <div className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)]">
              {runName(Number(runParam)) || t("platformMisc.responses.thisRun")}
            </div>
          ) : (
            <>
              {/* Form selector */}
              <select
                value={selectedFormId}
                onChange={event => { selectForm(event.target.value); setStatusFilter("all"); }}
                className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("platformMisc.responses.allForms")}</option>
                {forms.filter(form => form.status === "published").map(form => (
                  <option key={form.id} value={form.id}>{form.name}</option>
                ))}
              </select>

              {selectedFormId && (
                <button onClick={() => selectForm("")} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              type="text" placeholder={t("platformMisc.responses.searchPlaceholder")} value={search}
              onChange={event => setSearch(event.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
            />
          </div>

          {[
            { id: "all", label: t("platformMisc.responses.filterAll"), count: submissionCounts.all },
            { id: "submitted", label: t("platformMisc.responses.filterPending"), count: submissionCounts.submitted },
            { id: "approved", label: t("platformMisc.responses.filterApproved"), count: submissionCounts.approved },
            { id: "rejected", label: t("platformMisc.responses.filterRejected"), count: submissionCounts.rejected },
          ].map(filterOption => (
            <button key={filterOption.id} onClick={() => setStatusFilter(filterOption.id)}
              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                statusFilter === filterOption.id ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
              {filterOption.label} ({filterOption.count})
            </button>
          ))}
        </div>

        {/* Column legend when form selected */}
        {selectedFormId && formFields.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] relative">
            <button onClick={() => setShowColumnPicker(!showColumnPicker)} className="flex items-center gap-1 px-2 py-1 rounded bg-tertiary border border-[var(--border-primary)] hover:text-[var(--text-primary)]">
              <Filter className="w-3 h-3" /> {t("platformMisc.responses.columns", { visible: visibleFields.length, total: formFields.length })}
            </button>
            {showColumnPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-64 overflow-y-auto rounded-xl bg-secondary border border-[var(--border-primary)] shadow-lg p-2 space-y-1" onClick={event => event.stopPropagation()}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-2 py-1">{t("platformMisc.responses.selectColumns")}</p>
                {formFields.map(formField => (
                  <label key={formField.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-tertiary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleFieldIds.includes(String(formField.id))}
                      onChange={() => toggleField(formField.id)}
                      className="w-3 h-3 rounded accent-[var(--brand-orange)]"
                    />
                    <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">{formField.label}</span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">{formField.field_type}</span>
                  </label>
                ))}
                <div className="flex gap-2 px-2 pt-1 border-t border-[var(--border-primary)]">
                  <button onClick={() => setFieldChoices({ form: selectedFormId, ids: shownFields.slice(0, 3).map(formField => String(formField.id)) })} className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("platformMisc.responses.reset")}</button>
                  <button onClick={() => setFieldChoices({ form: selectedFormId, ids: shownFields.map(formField => String(formField.id)) })} className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("platformMisc.responses.selectAll")}</button>
                  <button onClick={() => setFieldChoices({ form: selectedFormId, ids: [] })} className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("platformMisc.responses.clear")}</button>
                </div>
              </div>
            )}
            <span>{visibleFields.map(formField => formField.label).join(" · ") || t("platformMisc.responses.noColumnsSelected")}</span>
          </div>
        )}
        {showColumnPicker && <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />}
      </div>

      {/* Spreadsheet Table */}
      <div className="flex-1 overflow-auto">
        {loading || fieldsLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-[var(--text-secondary)] opacity-20 mb-4" />
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">{t("platformMisc.responses.noSubmissions")}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
              {selectedFormId ? t("platformMisc.responses.noResponsesForForm") : t("platformMisc.responses.launchRunPrompt")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="sticky top-0 bg-secondary z-10">
                <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border-primary)]">
                  <th className="px-3 py-3 sticky left-0 bg-secondary z-20">#</th>
                  <th className="px-3 py-3 sticky left-[40px] bg-secondary z-20">{t("platformMisc.responses.applicant")}</th>
                  {/* Dynamic form field columns */}
                  {selectedFormId && visibleFields.map(formField => (
                    <th key={formField.id} className="px-3 py-3 max-w-[130px]" title={formField.label}>
                      <span className="line-clamp-1">{formField.label.length > 25 ? formField.label.substring(0, 25) + "..." : formField.label}</span>
                    </th>
                  ))}
                  {!selectedFormId && (
                    <>
                      <th className="px-3 py-3 hidden md:table-cell">{t("platformMisc.responses.form")}</th>
                      <th className="px-3 py-3 hidden md:table-cell">{t("platformMisc.responses.run")}</th>
                    </>
                  )}
                  <th className="px-3 py-3 w-16 text-center">{t("platformMisc.responses.score")}</th>
                  <th className="px-3 py-3 w-20">{t("platformMisc.responses.status")}</th>
                  <th className="px-3 py-3 w-24 hidden lg:table-cell">{t("platformMisc.responses.date")}</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {filtered.map((submission, index) => {
                  const statusClass = {
                    submitted: "text-blue-500 bg-blue-500/10",
                    approved: "text-emerald-500 bg-emerald-500/10",
                    rejected: "text-rose-500 bg-rose-500/10",
                    draft: "text-slate-500 bg-slate-500/10",
                    revision_requested: "text-amber-500 bg-amber-500/10",
                  }[submission.status] || "";
                  const scoreColor = submission.overall >= 80 ? "text-emerald-500" : submission.overall >= 60 ? "text-amber-500" : submission.overall != null ? "text-rose-500" : "text-[var(--text-secondary)]";
                  return (
                    <tr key={submission.id} className="hover:bg-tertiary/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/platform/runs/review/${submission.id}`)}>
                      <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] sticky left-0 bg-primary group-hover:bg-tertiary/30">{index + 1}</td>
                      <td className="px-3 py-3 sticky left-[40px] bg-primary group-hover:bg-tertiary/30">
                        <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">
                          {submission.submitter_name || submission.submitter_id || t("platformMisc.responses.anonymous")}
                        </span>
                      </td>
                      {/* Dynamic cell values */}
                      {selectedFormId && visibleFields.map(formField => (
                        <td key={formField.id} className="px-3 py-3 text-[10px] text-[var(--text-primary)] whitespace-nowrap max-w-[200px] truncate">
                          {formatCell(getFieldValue(submission, formField))}
                        </td>
                      ))}
                      {!selectedFormId && (
                        <>
                          <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] hidden md:table-cell">{formName(submission.form_id)}</td>
                          <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] hidden md:table-cell">{runName(submission.run_id)}</td>
                        </>
                      )}
                      <td className="px-3 py-3 text-center">
                        {submission.overall != null ? (
                          <span className={cn("text-xs font-black", scoreColor)}>{submission.overall}%</span>
                        ) : <span className="text-[10px] text-[var(--text-secondary)]">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", statusClass)}>{submission.status}</span>
                      </td>
                      <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] hidden lg:table-cell">
                        {submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Eye className="w-3.5 h-3.5 text-[var(--text-secondary)] hover:text-[var(--brand-orange)]" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResponsesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>}>
      <ResponsesContent />
    </Suspense>
  );
}
