"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Wallet,
  DollarSign,
  Filter,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import DashboardLayout from "@/components/layout/DashboardLayout";

const PROJECTS = [
  "All Projects",
  "Future Studio",
  "MTN Innovation Lab",
  "Sème City",
];

function formatCurrency(val) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="card !p-6 flex items-center gap-5">
      <div className={`p-4 rounded-2xl ${color}/10`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div>
        <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          {title}
        </p>
        <p className="text-xl font-black text-[var(--text-primary)] mt-1">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AdminFinanceDashboard() {
  const [summary, setSummary] = useState({
    totalPlanned: 0,
    totalActual: 0,
    remaining: 0,
    rate: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [budgetLines, setBudgetLines] = useState([]);
  const [selectedProject, setSelectedProject] = useState("All Projects");
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const projectParam =
        selectedProject === "All Projects" ? "all" : selectedProject;

      const [sumRes, txRes, monRes, budRes] = await Promise.all([
        fetch(
          `/api/finance/summary?project=${encodeURIComponent(projectParam)}`,
        ),
        fetch(
          `/api/finance/transactions?project=${encodeURIComponent(projectParam)}`,
        ),
        fetch(
          `/api/finance/monthly?project=${encodeURIComponent(projectParam)}`,
        ),
        fetch(
          `/api/finance/budget-lines?project=${encodeURIComponent(selectedProject === "All Projects" ? "Future Studio" : selectedProject)}`,
        ),
      ]);

      const sum = await sumRes.json();
      const tx = await txRes.json();
      const mon = await monRes.json();
      const bud = await budRes.json();

      if (sum.success) setSummary(sum);
      if (tx.success) setTransactions(tx.transactions || []);
      if (mon.success) setMonthly(mon.monthly || []);
      if (bud.success) setBudgetLines(bud.lines || []);
    } catch (e) {
      console.error("Finance fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter transactions by date range
  const filteredTransactions = transactions.filter((t) => {
    if (dateRange.from && t.date < dateRange.from) return false;
    if (dateRange.to && t.date > dateRange.to) return false;
    return true;
  });

  if (loading) {
    return (
      <DashboardLayout role="super_admin">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-t-[var(--brand-orange)] rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[var(--border-primary)] pb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)]">
                Finance Dashboard
              </h1>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {selectedProject === "All Projects"
                  ? "All projects — master overview"
                  : `Project: ${selectedProject}`}
              </p>
            </div>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-2 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            >
              {PROJECTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Summary Cards — react to project filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Budget"
            value={formatCurrency(summary.totalPlanned)}
            icon={Wallet}
            color="text-blue-500"
          />
          <StatCard
            title="Total Spent"
            value={formatCurrency(summary.totalActual)}
            icon={TrendingUp}
            color="text-[var(--brand-orange)]"
          />
          <StatCard
            title="Remaining"
            value={formatCurrency(summary.remaining)}
            icon={DollarSign}
            color="text-emerald-500"
          />
          <StatCard
            title="Consumption Rate"
            value={`${summary.rate}%`}
            icon={TrendingDown}
            color="text-purple-500"
          />
        </div>

        {/* Monthly Trend Chart — reacts to project filter */}
        <div className="card !p-6">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] mb-4">
            {selectedProject === "All Projects"
              ? "Monthly Spend Trend"
              : `${selectedProject} — Monthly Trend`}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthly}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-primary)"
              />
              <XAxis
                dataKey="month"
                stroke="var(--text-secondary)"
                fontSize={12}
              />
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: "12px",
                }}
                formatter={(value) => formatCurrency(value)}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#FF6600"
                strokeWidth={2}
                dot={{ fill: "#FF6600" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Tracker — already filtered by project */}
        <div className="card !p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              Budget Tracker
            </h3>
            <span className="text-[9px] text-[var(--text-secondary)]">
              {selectedProject === "All Projects"
                ? "Showing: Future Studio"
                : selectedProject}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Line Item
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">
                    Planned
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">
                    Actual
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {budgetLines.map((line, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border-primary)]/50 hover:bg-white/5"
                  >
                    <td className="p-3 text-xs font-bold text-[var(--text-primary)]">
                      {line.name}
                    </td>
                    <td className="p-3 text-xs font-bold text-[var(--text-primary)] text-right">
                      {formatCurrency(line.planned)}
                    </td>
                    <td className="p-3 text-xs font-bold text-[var(--text-primary)] text-right">
                      {formatCurrency(line.actual)}
                    </td>
                    <td
                      className={`p-3 text-xs font-bold text-right ${line.variance >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                    >
                      {formatCurrency(line.variance)}
                    </td>
                  </tr>
                ))}
                {budgetLines.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-[10px] text-[var(--text-secondary)] italic"
                    >
                      No budget data for this project
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Ledger — reacts to project filter */}
        <div className="card !p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              Transaction Ledger
            </h3>

            {/* Date range filter */}
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange({ ...dateRange, from: e.target.value })
                }
                className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
              <span className="text-[9px] text-[var(--text-secondary)]">
                to
              </span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) =>
                  setDateRange({ ...dateRange, to: e.target.value })
                }
                className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-primary">
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Date
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Supplier
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Description
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Category
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">
                    Amount Spent
                  </th>
                  <th className="p-3 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest text-right">
                    Amount Received
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border-primary)]/50 hover:bg-white/5"
                  >
                    <td className="p-3 text-[11px] text-[var(--text-primary)]">
                      {t.date}
                    </td>
                    <td className="p-3 text-[11px] font-bold text-[var(--text-primary)]">
                      {t.supplier}
                    </td>
                    <td className="p-3 text-[11px] text-[var(--text-secondary)]">
                      {t.description}
                    </td>
                    <td className="p-3 text-[11px] text-[var(--text-primary)]">
                      {t.category}
                    </td>
                    <td className="p-3 text-[11px] font-bold text-right text-rose-500">
                      {t.amountSpent ? formatCurrency(t.amountSpent) : "—"}
                    </td>
                    <td className="p-3 text-[11px] font-bold text-right text-emerald-500">
                      {t.amountReceived
                        ? formatCurrency(t.amountReceived)
                        : "—"}
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-[10px] text-[var(--text-secondary)] italic"
                    >
                      No transactions match the current filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
