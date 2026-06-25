"use client";

import React, { useState, useEffect } from "react";
import { Bell, RefreshCw, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DeveloperNotifications() {
  const [userRole, setUserRole] = useState("developer");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        setUserRole(u.role || "developer");
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated) {
          const res = await fetch(
            `/api/notifications?recipient_id=${sessionData.user.cid}`,
          );
          const data = await res.json();
          if (data.success) {
            setNotifications(data.notifications || []);
          }
        }
      } catch (e) {
        console.error("Failed to fetch notifications", e);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  return (
    <DashboardLayout role={userRole} activeTab="notifications">
      <div className="space-y-8 pb-20">
        <header className="border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Notifications
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Notifications
            </h1>
          </div>
        </header>

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
        ) : notifications.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <Bell className="w-16 h-16 text-slate-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              No notifications
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="ios-card !p-4 border-[var(--border-primary)]"
              >
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {n.title}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  {n.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
