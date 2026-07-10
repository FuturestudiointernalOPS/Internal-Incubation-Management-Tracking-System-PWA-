"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Loader2, GraduationCap, Mail, Clock, User, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * ALUMNI ENGAGEMENT (Ticket 6.5)
 * Track alumni — graduates remain in the ecosystem, can join future programs.
 */

const ALUMNI_STATUS = {
  active: {
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Active",
  },
  inactive: {
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Inactive",
  },
  engaged: {
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    label: "Engaged",
  },
};

export default function AlumniPage() {
  const { t } = useI18n();
  const [user, setUser] = useState({ role: "super_admin" });
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  const fetchAlumni = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alumni");
      const data = await res.json();
      if (data.success) setAlumni(data.alumni || []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlumni();
  }, [fetchAlumni]);

  const filtered = alumni.filter((a) => {
    const matchesSearch =
      !search ||
      (a.participant_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.participant_email || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: alumni.length,
    active: alumni.filter((a) => a.status === "active").length,
    engaged: alumni.filter((a) => a.status === "engaged").length,
    inactive: alumni.filter((a) => a.status === "inactive").length,
  };

  return (
    <DashboardLayout
      role={user.role === "program_manager" ? "program_manager" : "super_admin"}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("alumni.title") || "Alumni Network"}
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {t("alumni.subtitle") ||
                "Graduates remain connected to Future Studio — eligible for future programs and community participation"}
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: t("alumni.total") || "Total",
              value: stats.total,
              icon: GraduationCap,
              color: "text-[var(--brand-orange)]",
            },
            {
              label: t("alumni.active") || "Active",
              value: stats.active,
              icon: Star,
              color: "text-emerald-500",
            },
            {
              label: t("alumni.engaged") || "Engaged",
              value: stats.engaged,
              icon: User,
              color: "text-indigo-500",
            },
            {
              label: t("alumni.inactive") || "Inactive",
              value: stats.inactive,
              icon: Clock,
              color: "text-amber-500",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)]"
            >
              <card.icon className={`w-4 h-4 ${card.color} mb-2`} />
              <p className="text-2xl font-black text-[var(--text-primary)]">
                {card.value}
              </p>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {card.label}
              </p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder={t("alumni.search") || "Search alumni..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="engaged">Engaged</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Alumni list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-30" />
            <p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">
              {t("alumni.empty") || "No alumni records yet"}
            </p>
            <p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">
              {t("alumni.emptyHint") ||
                "Alumni records are created when participants graduate from a program"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => {
              const cfg = ALUMNI_STATUS[a.status] || ALUMNI_STATUS.active;
              return (
                <div
                  key={a.id}
                  className="p-5 rounded-2xl bg-secondary border border-[var(--border-primary)] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[12px] font-black text-[var(--text-primary)]">
                        {a.participant_name || a.participant_id}
                      </p>
                      {a.participant_email && (
                        <p className="text-[9px] text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {a.participant_email}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded-md text-[8px] font-black ${cfg.color} ${cfg.bg}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {a.graduated_program_name && (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] bg-tertiary rounded-lg p-2">
                      <GraduationCap className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                      <span className="font-bold">
                        {a.graduated_program_name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[9px] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {a.alumni_since
                        ? new Date(a.alumni_since).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>

                  {a.notes && (
                    <p className="text-[9px] text-[var(--text-secondary)] italic border-t border-[var(--border-primary)] pt-2 mt-2">
                      {a.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
