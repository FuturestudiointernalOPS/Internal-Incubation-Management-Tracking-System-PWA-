"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, ArrowUpDown, Eye, CheckCircle2, XCircle, Clock, RotateCcw, Sparkles, Hash } from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

export default function ResponsesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState([]);
  const [allSubs, setAllSubs] = useState([]);
  const [forms, setForms] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState({ key: "submitted_at", dir: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load all runs
      const runsRes = await fetch("/api/platform/form-runs");
      const runsData = await runsRes.json();
      const runsList = runsData.runs || [];
      setRuns(runsList);

      // Load forms for names
      const formsRes = await fetch("/api/platform/forms");
      const formsData = await formsRes.json();
      const formsList = formsData.forms || [];
      setForms(formsList);

      // Load submissions for each active/closed run
      const all = [];
      for (const run of runsList.filter(r => r.status !== "draft" && r.status !== "cancelled")) {
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

  const filtered = allSubs
    .filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (s.submitter_name || s.submitter_id || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av = a[sort.key] || "";
      const bv = b[sort.key] || "";
      return av > bv ? dir : av < bv ? -dir : 0;
    });

  const handleSort = (key) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
  };

  const subCounts = { all: allSubs.length, submitted: allSubs.filter(s => s.status === "submitted").length, approved: allSubs.filter(s => s.status === "approved").length, rejected: allSubs.filter(s => s.status === "rejected").length, draft: allSubs.filter(s => s.status === "draft").length };

  const formName = (formId) => forms.find(f => f.id === formId)?.name || "—";
  const runName = (runId) => runs.find(r => r.id === runId)?.name || "—";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-primary)] bg-secondary shrink-0 space-y-3">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">Responses</h1>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">{allSubs.length} submissions across {runs.length} runs</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input type="text" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none" />
          </div>
          {[
            { id: "all", label: `All (${subCounts.all})` },
            { id: "submitted", label: `Pending (${subCounts.submitted})` },
            { id: "approved", label: `Approved (${subCounts.approved})` },
            { id: "rejected", label: `Rejected (${subCounts.rejected})` },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", statusFilter === f.id ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-secondary)] text-xs">No submissions found</div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-secondary z-10">
              <tr className="text-[9px] font-black uppercase text-[var(--text-secondary)] border-b border-[var(--border-primary)]">
                <th className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)]" onClick={() => handleSort("submitter_name")}>
                  <span className="flex items-center gap-1">Applicant <ArrowUpDown className="w-2.5 h-2.5" /></span>
                </th>
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)]" onClick={() => handleSort("overall")}>
                  <span className="flex items-center gap-1">Score <ArrowUpDown className="w-2.5 h-2.5" /></span>
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 cursor-pointer hover:text-[var(--text-primary)]" onClick={() => handleSort("submitted_at")}>
                  <span className="flex items-center gap-1">Submitted <ArrowUpDown className="w-2.5 h-2.5" /></span>
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {filtered.map(s => {
                const sc = { submitted: "text-blue-500", approved: "text-emerald-500", rejected: "text-rose-500", draft: "text-slate-500", revision_requested: "text-amber-500" }[s.status] || "";
                const scoreColor = s.overall >= 80 ? "text-emerald-500" : s.overall >= 60 ? "text-amber-500" : s.overall != null ? "text-rose-500" : "text-[var(--text-secondary)]";
                return (
                  <tr key={s.id} className="hover:bg-tertiary/30 transition-colors cursor-pointer" onClick={() => router.push(`/platform/runs/review/${s.id}`)}>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{s.submitter_name || s.submitter_id || "Anonymous"}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{formName(s.form_id)}</td>
                    <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{runName(s.run_id)}</td>
                    <td className="px-4 py-3">
                      {s.overall != null ? (
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-xs font-black", scoreColor)}>{s.overall}%</span>
                          {s.ranking && <span className="text-[8px] text-[var(--text-secondary)]">{s.ranking}</span>}
                        </div>
                      ) : <span className="text-[10px] text-[var(--text-secondary)]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", sc)}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-[var(--text-secondary)]">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <Eye className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
