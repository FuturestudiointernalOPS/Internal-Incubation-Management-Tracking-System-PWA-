"use client";

import { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
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
  const [eventsLoading, setEventsLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  // Fetch calendar events from the home API
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/participant/home");
        const data = await res.json();
        if (data.success) {
          setCalendarEvents(data.calendarEvents || []);
        }
      } catch (e) {
        console.error("Failed to load calendar events", e);
      } finally {
        setEventsLoading(false);
      }
    }
    if (user.cid || user.id) fetchEvents();
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
