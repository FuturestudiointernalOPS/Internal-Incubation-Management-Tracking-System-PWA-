"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Eye, FileText, Filter, X } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

export default function ResponsesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [forms, setForms] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFormId, setSelectedFormId] = useState("");
  const [formFields, setFormFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [visibleFieldIds, setVisibleFieldIds] = useState([]); // user-selected columns
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, formsRes] = await Promise.all([
        fetch("/api/platform/form-runs"),
        fetch("/api/platform/forms"),
      ]);
      const [runsData, formsData] = await Promise.all([runsRes.json(), formsRes.json()]);
      setRuns(runsData.runs || []);
      setForms(formsData.forms || []);

      const all = [];
      for (const run of (runsData.runs || []).filter(r => !["draft", "cancelled"].includes(r.status))) {
        try {
          const subRes = await fetch(`/api/platform/form-runs?id=${run.id}`);
          const subData = await subRes.json();
          if (subData.success && subData.submissions) {
            for (const s of subData.submissions) {
              const subScores = s.data?._scores;
              all.push({
                ...s,
                run_name: run.name,
                run_id: run.id,
                form_id: run.form_id,
                overall: subScores?.overall,
                ranking: subScores?.ranking,
              });
            }
          }
        } catch (_) {}
      }
      setAllSubs(all);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load form fields when a form is selected
  useEffect(() => {
    if (!selectedFormId) { setFormFields([]); setVisibleFieldIds([]); return; }
    setFieldsLoading(true);
    fetch(`/api/platform/forms?id=${selectedFormId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const allFields = (d.fields || []).filter(f => !["hidden"].includes(f.field_type));
          setFormFields(allFields);
          setVisibleFieldIds(allFields.slice(0, 3).map(f => String(f.id)));
        }
      })
      .catch(() => {})
      .finally(() => setFieldsLoading(false));
  }, [selectedFormId]);

  // Filter submissions by selected form
  const formFilteredSubs = useMemo(() => {
    if (!selectedFormId) return allSubs;
    return allSubs.filter(s => String(s.form_id) === String(selectedFormId));
  }, [allSubs, selectedFormId]);

  const filtered = formFilteredSubs
    .filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (s.submitter_name || s.submitter_id || "").toLowerCase();
        if (name.includes(q)) return true;
        const dataValues = Object.values(s.data || {}).map(v => typeof v === "string" ? v.toLowerCase() : "").join(" ");
        return dataValues.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const ad = a.submitted_at || "";
      const bd = b.submitted_at || "";
      return bd > ad ? 1 : bd < ad ? -1 : 0;
    });

  const subCounts = {
    all: formFilteredSubs.length,
    submitted: formFilteredSubs.filter(s => s.status === "submitted").length,
    approved: formFilteredSubs.filter(s => s.status === "approved").length,
    rejected: formFilteredSubs.filter(s => s.status === "rejected").length,
  };

  const formName = (formId) => forms.find(f => f.id === formId)?.name || "—";
  const runName = (runId) => runs.find(r => r.id === runId)?.name || "—";

  const visibleFields = formFields.filter(f => visibleFieldIds.includes(String(f.id)));

  const toggleField = (fieldId) => {
    setVisibleFieldIds(prev =>
      prev.includes(String(fieldId))
        ? prev.filter(id => id !== String(fieldId))
        : [...prev, String(fieldId)]
    );
  };

  const formatCell = (val) => {
    if (val === undefined || val === null || val === "") return "—";
    const s = String(val);
    if (s.startsWith("{") && s.includes('"code"')) {
      try { const p = JSON.parse(s); if (p.code && p.number) return `${p.code} ${p.number}`; } catch (_) {}
    }
    return s.length > 35 ? s.substring(0, 35) + "..." : s;
  };

  const getFieldValue = (submission, field) => {
    return submission.data?.[field.label] ?? submission.data?.[String(field.id)] ?? submission.data?.[field.id];
  };

  const selectedForm = forms.find(f => String(f.id) === String(selectedFormId));

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-secondary shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">Responses</h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {selectedForm
                ? `${filtered.length} submissions for "${selectedForm.name}"`
                : `${allSubs.length} submissions across ${runs.filter(r => !["draft","cancelled"].includes(r.status)).length} runs`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Form selector */}
          <select
            value={selectedFormId}
            onChange={e => { setSelectedFormId(e.target.value); setStatusFilter("all"); }}
            className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">All Forms</option>
            {forms.filter(f => f.status === "published").map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          {selectedFormId && (
            <button onClick={() => setSelectedFormId("")} className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              type="text" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
            />
          </div>

          {[
            { id: "all", label: "All", count: subCounts.all },
            { id: "submitted", label: "Pending", count: subCounts.submitted },
            { id: "approved", label: "Approved", count: subCounts.approved },
            { id: "rejected", label: "Rejected", count: subCounts.rejected },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                statusFilter === f.id ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Column legend when form selected */}
        {selectedFormId && formFields.length > 0 && (
          <div className="flex items-center gap-2 text-[8px] text-[var(--text-secondary)] relative">
            <button onClick={() => setShowColumnPicker(!showColumnPicker)} className="flex items-center gap-1 px-2 py-1 rounded bg-tertiary border border-[var(--border-primary)] hover:text-[var(--text-primary)]">
              <Filter className="w-3 h-3" /> Columns ({visibleFields.length}/{formFields.length})
            </button>
            {showColumnPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 w-64 max-h-64 overflow-y-auto rounded-xl bg-secondary border border-[var(--border-primary)] shadow-lg p-2 space-y-1" onClick={e => e.stopPropagation()}>
                <p className="text-[8px] font-black uppercase text-[var(--text-secondary)] px-2 py-1">Select Columns</p>
                {formFields.map(f => (
                  <label key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-tertiary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleFieldIds.includes(String(f.id))}
                      onChange={() => toggleField(f.id)}
                      className="w-3 h-3 rounded accent-[var(--brand-orange)]"
                    />
                    <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">{f.label}</span>
                    <span className="text-[8px] text-[var(--text-secondary)] ml-auto">{f.field_type}</span>
                  </label>
                ))}
                <div className="flex gap-2 px-2 pt-1 border-t border-[var(--border-primary)]">
                  <button onClick={() => setVisibleFieldIds(formFields.slice(0, 3).map(f => String(f.id)))} className="text-[8px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Reset</button>
                  <button onClick={() => setVisibleFieldIds(formFields.map(f => String(f.id)))} className="text-[8px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Select All</button>
                  <button onClick={() => setVisibleFieldIds([])} className="text-[8px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Clear</button>
                </div>
              </div>
            )}
            <span>{visibleFields.map(f => f.label).join(" · ") || "No columns selected"}</span>
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
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase">No submissions</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
              {selectedFormId ? "No responses for this form yet" : "Launch a run and share the link"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="sticky top-0 bg-secondary z-10">
                <tr className="text-[9px] font-black uppercase text-[var(--text-secondary)] border-b border-[var(--border-primary)]">
                  <th className="px-3 py-3 sticky left-0 bg-secondary z-20">#</th>
                  <th className="px-3 py-3 sticky left-[40px] bg-secondary z-20">Applicant</th>
                  {/* Dynamic form field columns */}
                  {selectedFormId && visibleFields.map(f => (
                    <th key={f.id} className="px-3 py-3 max-w-[130px]" title={f.label}>
                      <span className="line-clamp-1">{f.label.length > 25 ? f.label.substring(0, 25) + "..." : f.label}</span>
                    </th>
                  ))}
                  {!selectedFormId && (
                    <>
                      <th className="px-3 py-3 hidden md:table-cell">Form</th>
                      <th className="px-3 py-3 hidden md:table-cell">Run</th>
                    </>
                  )}
                  <th className="px-3 py-3 w-16 text-center">Score</th>
                  <th className="px-3 py-3 w-20">Status</th>
                  <th className="px-3 py-3 w-24 hidden lg:table-cell">Date</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {filtered.map((s, idx) => {
                  const sc = {
                    submitted: "text-blue-500 bg-blue-500/10",
                    approved: "text-emerald-500 bg-emerald-500/10",
                    rejected: "text-rose-500 bg-rose-500/10",
                    draft: "text-slate-500 bg-slate-500/10",
                    revision_requested: "text-amber-500 bg-amber-500/10",
                  }[s.status] || "";
                  const scoreColor = s.overall >= 80 ? "text-emerald-500" : s.overall >= 60 ? "text-amber-500" : s.overall != null ? "text-rose-500" : "text-[var(--text-secondary)]";
                  return (
                    <tr key={s.id} className="hover:bg-tertiary/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/platform/runs/review/${s.id}`)}>
                      <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] sticky left-0 bg-primary group-hover:bg-tertiary/30">{idx + 1}</td>
                      <td className="px-3 py-3 sticky left-[40px] bg-primary group-hover:bg-tertiary/30">
                        <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">
                          {s.submitter_name || s.submitter_id || "Anonymous"}
                        </span>
                      </td>
                      {/* Dynamic cell values */}
                      {selectedFormId && visibleFields.map(f => (
                        <td key={f.id} className="px-3 py-3 text-[10px] text-[var(--text-primary)] whitespace-nowrap max-w-[200px] truncate">
                          {formatCell(getFieldValue(s, f))}
                        </td>
                      ))}
                      {!selectedFormId && (
                        <>
                          <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] hidden md:table-cell">{formName(s.form_id)}</td>
                          <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] hidden md:table-cell">{runName(s.run_id)}</td>
                        </>
                      )}
                      <td className="px-3 py-3 text-center">
                        {s.overall != null ? (
                          <span className={cn("text-xs font-black", scoreColor)}>{s.overall}%</span>
                        ) : <span className="text-[10px] text-[var(--text-secondary)]">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", sc)}>{s.status}</span>
                      </td>
                      <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] hidden lg:table-cell">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "—"}
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
