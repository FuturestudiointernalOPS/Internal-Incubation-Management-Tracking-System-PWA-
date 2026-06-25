"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Shield, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function DeveloperProfile() {
  const [userRole, setUserRole] = useState("developer");
  const [user, setUser] = useState(null);
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
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData.authenticated) {
          setUser(sessionData.user);
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  return (
    <DashboardLayout role={userRole} activeTab="profile">
      <div className="space-y-8 pb-20">
        <header className="border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Profile
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              My Profile
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }}
            />
          </div>
        ) : user ? (
          <div className="max-w-md space-y-4">
            <div className="ios-card !p-6 border-[var(--border-primary)] space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-[var(--brand-orange)]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">{user.name}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/10 text-[var(--brand-orange)] uppercase tracking-wider">{user.role}</span>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">{user.cid}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs font-bold text-slate-500">Could not load profile</p>
        )}
      </div>
    </DashboardLayout>
  );
}
