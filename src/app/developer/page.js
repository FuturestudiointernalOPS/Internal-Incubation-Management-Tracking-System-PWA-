"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Activity, AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function DeveloperDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/errors");
      const data = await res.json();
      if (data.success) {
        setErrors(data.errors || []);
      }
    } catch (e) {
      console.error("Failed to fetch errors", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const totalErrors = errors.length;
  const unresolvedErrors = errors.filter(
    (e) => !e.resolved,
  ).length;
  const criticalErrors = errors.filter(
    (e) => e.severity === "critical" || e.severity === "fatal",
  ).length;

  const stats = [
    {
      label: "Total Errors",
      value: totalErrors,
      icon: Activity,
      color: "var(--brand-orange)",
      bg: "rgba(255,102,0,0.1)",
    },
    {
      label: "Unresolved",
      value: unresolvedErrors,
      icon: AlertTriangle,
      color: "var(--chart-danger, #ef4444)",
      bg: "rgba(239,68,68,0.1)",
    },
    {
      label: "Critical",
      value: criticalErrors,
      icon: CheckCircle2,
      color: "var(--chart-danger, #ef4444)",
      bg: "rgba(239,68,68,0.1)",
    },
  ];

  return (
    <DashboardLayout role="developer" activeTab="dashboard">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Developer Console
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Developer Console
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              System health and error monitoring
            </p>
          </div>
        </header>

        {/* Stats Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="card bg-secondary border-[var(--border-primary)] p-6 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: stat.bg }}
                  >
                    <stat.icon
                      className="w-5 h-5"
                      style={{ color: stat.color }}
                    />
                  </div>
                </div>
                <p
                  className="text-3xl font-black tracking-tight"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/developer/errors")}
            className="ios-card !p-6 flex items-center gap-4 hover:border-[var(--brand-orange)]/30 transition-all text-left"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,102,0,0.1)" }}
            >
              <Activity className="w-6 h-6 text-[var(--brand-orange)]" />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                Error Logs
              </p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                View and manage all captured errors
              </p>
            </div>
          </button>
          <div className="ios-card !p-6 flex items-center gap-4 opacity-50">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(100,100,100,0.1)" }}
            >
              <Wrench className="w-6 h-6 text-[var(--text-secondary)]" />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                More Tools
              </p>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5">
                Coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
