"use client";

import { useState, useEffect } from "react";
import { Calendar, AlertCircle, Clock, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProgramListing from "@/components/dashboard/ProgramListing";
import CalendarPanel from "@/components/ui/CalendarPanel";

/**
 * PARTICIPANT DASHBOARD
 *
 * Shows enrolled programs + a calendar with upcoming session dates.
 */
export default function ParticipantDashboard() {
  const [user, setUser] = useState({});
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [actionCenter, setActionCenter] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  // Fetch data from the home API
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/participant/home");
        const data = await res.json();
        if (data.success) {
          setCalendarEvents(data.calendarEvents || []);
          setActionCenter(data.actionCenter || null);
        }
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setEventsLoading(false);
      }
    }
    if (user.cid || user.id) fetchData();
  }, [user]);

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
            {t("reports.companyReports")}
          </span>
        </div>

        {/* Main content: Programs + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProgramListing />
          </div>
          <div className="space-y-4">
            <CalendarPanel events={calendarEvents} />
            {eventsLoading && calendarEvents.length === 0 && (
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
                {/* Overdue */}
                {actionCenter.overdue?.length > 0 && (
                  <div className="card border-l-4 border-l-rose-500 !py-3 !px-4">
                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-2">
                      Overdue ({actionCenter.overdue.length})
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
                            {item.daysOverdue}d overdue
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Due Soon */}
                {actionCenter.dueSoon?.length > 0 && (
                  <div className="card border-l-4 border-l-amber-500 !py-3 !px-4">
                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-2">
                      Due This Week ({actionCenter.dueSoon.length})
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

                {/* Pending Submissions */}
                {actionCenter.pendingSubmissions?.length > 0 && (
                  <div className="card border-l-4 border-l-blue-500 !py-3 !px-4">
                    <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-2">
                      Pending Review ({actionCenter.pendingSubmissions.length})
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
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
