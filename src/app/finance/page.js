"use client";

import React, { useState, useEffect } from "react";
import { Send, DollarSign, Calendar, Building2, FileText, CheckCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function FinanceEntryPage() {
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

  useEffect(() => {
    if (form.project) {
      fetch(`/api/finance/budget-lines?project=${encodeURIComponent(form.project)}`)
        .then(r => r.json())
        .then(d => { if (d.success) { setBudgetLines(d.lines); setFilteredLines(d.lines); } })
        .catch(() => {});
    }
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
        setError(data.error || "Submission failed.");
      }
    } catch (e) {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout role="finance">
      <div className="max-w-2xl mx-auto space-y-8 pb-20">
        <header className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-6">
          <DollarSign className="w-6 h-6 text-emerald-500" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)]">Transaction Entry</h1>
            <p className="text-[10px] text-[var(--text-secondary)]">Log a new financial transaction</p>
          </div>
        </header>

        {success && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
            <CheckCircle className="w-5 h-5" />
            <span className="text-xs font-bold">Transaction logged successfully</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="card !p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Project *</label>
              <select
                required
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value, budgetLine: "" })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="">Select Project...</option>
                <option value="Future Studio">Future Studio</option>
                <option value="MTN Innovation Lab">MTN Innovation Lab</option>
                <option value="Sème City">Sème City</option>
              </select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Date *</label>
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
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Budget Line *</label>
              <input
                type="text"
                required
                placeholder="Search or type budget line..."
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
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Supplier</label>
              <input
                type="text"
                placeholder="Supplier name..."
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Amount (FCFA) *</label>
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
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Description</label>
            <textarea
              placeholder="Transaction details..."
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
            {submitting ? "Submitting..." : <><Send className="w-4 h-4" /> Log Transaction</>}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
