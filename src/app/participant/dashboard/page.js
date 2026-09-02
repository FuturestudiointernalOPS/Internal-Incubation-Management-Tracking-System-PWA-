"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  AlertCircle,
  Clock,
  Send,
  Bell,
  Target,
  TrendingUp,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ProgramListing from "@/components/dashboard/ProgramListing";
import CalendarPanel from "@/components/ui/CalendarPanel";
import Link from "next/link";

/**
 * PARTICIPANT DASHBOARD (ENHANCED)
 *
 * Shows enrolled programs, current program + week, progress summary,
 * calendar with upcoming events, action center, and notifications.
 */
export default function ParticipantDashboard() {
  const [user, setUser] = useState({});
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [actionCenter, setActionCenter] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [primaryProgram, setPrimaryProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  // Fetch data from the home API
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("/api/participant/home");
        const data = await res.json();
        if (data.success) {
          setCalendarEvents(data.calendarEvents || []);
          setActionCenter(data.actionCenter || null);
          setAnnouncements(data.announcements || []);
          setPrimaryProgram(data.primaryProgram || null);
        }
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
    if (user.cid || user.id) fetchData();
  }, [user]);

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
            {t("participant.dashboard")}
          </span>
        </div>

        {/* Current Program Mini Banner */}
        {primaryProgram && (
          <div className="bg-gradient-to-r from-[var(--brand-orange)]/10 to-transparent border border-[var(--brand-orange)]/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--brand-orange)]/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("participant.activeSession")}
                  </p>
                  <p className="text-sm font-black text-[var(--text-primary)]">
                    {primaryProgram.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] font-bold text-[var(--brand-orange)]">
                      {t("participant.week")} {primaryProgram.currentWeek}
                      {primaryProgram.durationWeeks
                        ? ` / ${primaryProgram.durationWeeks}`
                        : ""}
                    </span>
                    <span className="text-[9px] font-bold text-[var(--text-tertiary)]">
                      {primaryProgram.cohort}
                    </span>
                    <span
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                        primaryProgram.metrics?.percentComplete >= 80
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      {primaryProgram.metrics?.percentComplete || 0}%{" "}
                      {t("participant.progress")}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={`/participant/${primaryProgram.id}`}
                className="flex items-center gap-1 text-[9px] font-bold text-[var(--brand-orange)] hover:gap-2 transition-all"
              >
                {t("participant.details")} <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Main content: Programs + Calendar + Action Center + Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProgramListing />

            {/* Announcements/Notifications Section */}
            {announcements.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                  <span className="text-[9px] font-black text-[var(--brand-orange)] uppercase tracking-[0.3em]">
                    {t("participant.announcements")}
                  </span>
                </div>
                <div className="space-y-2">
                  {announcements.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className={`card !py-3 !px-4 ${
                        !item.isRead
                          ? "border-l-4 border-l-[var(--brand-orange)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                            {item.title}
                          </p>
                          {item.message && (
                            <p className="text-[9px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                              {item.message}
                            </p>
                          )}
                        </div>
                        <span className="text-[7px] text-[var(--text-tertiary)] shrink-0 whitespace-nowrap">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString()
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <CalendarPanel events={calendarEvents} />
            {loading && calendarEvents.length === 0 && (
              <div className="flex justify-center py-8">
                <div
                  className="w-5 h-5 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                  style={{
                    borderColor: "rgba(255,102,0,0.1)",
                    borderTopColor: "var(--brand-orange)",
                  }}
                />
              </div>
            )}

            {/* Action Center */}
            {actionCenter && (
              <div className="space-y-3">
                {actionCenter.overdue?.length > 0 && (
                  <div className="card border-l-4 border-l-rose-500 !py-3 !px-4">
                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-2">
                      {t("participant.overdue") || "Overdue"} ({actionCenter.overdue.length})
                    </p>
                    <div className="space-y-1.5">
                      {actionCenter.overdue.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]"
                        >
                          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">{item.title}</span>
                          <span className="text-[7px] text-rose-500 shrink-0">
                            {item.daysOverdue}d {t("participant.overdue") || "overdue"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionCenter.dueSoon?.length > 0 && (
                  <div className="card border-l-4 border-l-amber-500 !py-3 !px-4">
                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-2">
                      {t("participant.dueSoon") || "Due This Week"} ({actionCenter.dueSoon.length})
                    </p>
                    <div className="space-y-1.5">
                      {actionCenter.dueSoon.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]"
                        >
                          <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="truncate">{item.title}</span>
                          <span className="text-[7px] text-amber-500 shrink-0">
                            {item.daysLeft}d left
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {actionCenter.pendingSubmissions?.length > 0 && (
                  <div className="card border-l-4 border-l-blue-500 !py-3 !px-4">
                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-2">
                      {t("participant.pending") || "Pending Review"} ({actionCenter.pendingSubmissions.length})
                    </p>
                    <div className="space-y-1.5">
                      {actionCenter.pendingSubmissions
                        .slice(0, 3)
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]"
                          >
                            <Send className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="truncate">
                              Deliverable #{item.deliverableId}
                            </span>
                            <span className="text-[7px] text-blue-500 shrink-0">
                              {item.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Sessions */}
                {actionCenter.upcomingSessions?.length > 0 && (
                  <div className="card border-l-4 border-l-emerald-500 !py-3 !px-4">
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2">
                      {t("participant.upcomingDeadlines") || "Upcoming Sessions"} ({actionCenter.upcomingSessions.length})
                    </p>
                    <div className="space-y-1.5">
                      {actionCenter.upcomingSessions.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]"
                        >
                          <BookOpen className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="truncate">{item.title}</span>
                          <span className="text-[7px] text-emerald-500 shrink-0">
                            {item.date
                              ? new Date(item.date).toLocaleDateString()
                              : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
