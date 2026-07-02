"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  MessageSquare,
  Calendar,
  ListTodo,
  Users,
  Bell,
  Target,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

export default function DeveloperDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated && sessionData.user) {
          setUser(sessionData.user);
        } else {
          const saved = localStorage.getItem("user");
          if (saved) {
            const u = JSON.parse(saved);
            if (u.id || u.cid) setUser(u);
          }
        }
      } catch (_) {
        const saved = localStorage.getItem("user");
        if (saved) {
          const u = JSON.parse(saved);
          if (u.id || u.cid) setUser(u);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return (
      <DashboardLayout role="developer" activeTab="dashboard">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={user?.role || "developer"} activeTab="dashboard">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("navigation.dashboard")}
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("navigation.dashboard")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              Your personal operational workspace
            </p>
          </div>
        </header>

        {/* Use the existing UnifiedDashboard component which already has all required widgets */}
        <UnifiedDashboard role={user?.role || "developer"} />
      </div>
    </DashboardLayout>
  );
}
