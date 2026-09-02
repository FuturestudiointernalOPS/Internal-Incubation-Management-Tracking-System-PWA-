"use client";

import React, { useState, useEffect } from "react";
import { Send, DollarSign, Calendar, Building2, FileText, CheckCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export default function FinanceEntryPage() {
  const { t } = useI18n();
  const [form, setForm] = useState({
    project: "",
    budgetLine: "",
    date: "",
    supplier: "",
    description: "",
    amount: "",
    type: "expense",
  });
  const [budgetLines, setBudgetLines] = useState([]);
  const [filteredLines, setFilteredLines] = useState([]);
  const [lineSearch, setLineSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const loadBudgetLines = async (project, bypassCache = false) => {
    const url = `/api/finance/budget-lines?project=${encodeURIComponent(project)}`;
    const apply = (d) => {
      if (d?.success) {
        setBudgetLines(d.lines);
        setFilteredLines(d.lines);
      }
    };
    try {
      // Cache-first paint: switching back to a previously selected project
      // renders its budget lines instantly from a fresh snapshot.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const res = await fetch(url);
      const d = await res.json();
      if (d?.success) {
        cacheSet(url, d);
        apply(d);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (form.project) loadBudgetLines(form.project);
  }, [form.project]);

  useEffect(() => {
    if (!lineSearch) { setFilteredLines(budgetLines); return; }
    const q = lineSearch.toLowerCase();
    setFilteredLines(budgetLines.filter(l => l.name.toLowerCase().includes(q)));
  }, [lineSearch, budgetLines]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.project || !form.budgetLine || !form.date || !form.amount) {
      setError("Please fill all required fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/finance/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setForm({ project: "", budgetLine: "", date: "", supplier: "", description: "", amount: "", type: "expense" });
        setLineSearch("");
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(t((data.error || "Submission failed.") || "") || (data.error || "Submission failed."));
      }
    } catch (e) {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl mx-auto space-y-8 pb-20">
        <header className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-6">
          <DollarSign className="w-6 h-6 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)]">{t("rootMisc.finance.title")}</h1>
            <p className="text-[10px] text-[var(--text-secondary)]">{t("rootMisc.finance.subtitle")}</p>
          </div>
        </header>

        {success && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <CheckCircle className="w-5 h-5" />
            <span className="text-xs font-bold">{t("rootMisc.finance.transactionLogged")}</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="card !p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("rootMisc.finance.projectLabel")}</label>
              <select
                required
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value, budgetLine: "" })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="">{t("rootMisc.finance.selectProject")}</option>
                <option value="Future Studio">Future Studio</option>
                <option value="MTN Innovation Lab">MTN Innovation Lab</option>
                <option value="Sème City">Sème City</option>
              </select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("rootMisc.finance.dateLabel")}</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              />
            </div>

            {/* Budget Line */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("rootMisc.finance.budgetLineLabel")}</label>
              <input
                type="text"
                required
                placeholder={t("rootMisc.finance.searchBudgetLine")}
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              />
              {filteredLines.length > 0 && lineSearch && (
                <div className="max-h-32 overflow-y-auto bg-primary border border-[var(--border-primary)] rounded-xl mt-1">
                  {filteredLines.slice(0, 10).map((line, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setForm({ ...form, budgetLine: line.name }); setLineSearch(line.name); }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-tertiary transition-colors"
                    >
                      {line.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Supplier */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("rootMisc.finance.supplierLabel")}</label>
              <input
                type="text"
                placeholder={t("rootMisc.finance.supplierPlaceholder")}
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("rootMisc.finance.amountLabel")}</label>
              <input
                type="number"
                required
                min="0"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("rootMisc.finance.typeLabel")}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="expense">{t("rootMisc.finance.expense")}</option>
                <option value="income">{t("rootMisc.finance.income")}</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t("rootMisc.finance.descriptionLabel")}</label>
            <textarea
              placeholder={t("rootMisc.finance.descriptionPlaceholder")}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-emerald-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? t("rootMisc.finance.submitting") : <><Send className="w-4 h-4" /> {t("rootMisc.finance.logTransaction")}</>}
          </button>
        </form>
      </div>
    </>
  );
}
