"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, Clock, UserPlus, Activity } from "lucide-react";
import Link from "next/link";

export default function CrmDashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentContacts, setRecentContacts] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch contacts summary
        const contactsRes = await fetch("/api/contacts?status=active");
        const contactsData = await contactsRes.json();

        // Fetch pending users
        const pendingRes = await fetch("/api/contacts?status=pending");
        const pendingData = await pendingRes.json();

        setStats({
          totalContacts: contactsData.contacts?.length || 0,
          pendingApprovals: pendingData.contacts?.length || 0,
        });

        setRecentContacts((contactsData.contacts || []).slice(0, 10));
      } catch (e) {
        console.error("CRM dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <DashboardLayout role="super_admin" activeTab="crm">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            CRM Dashboard
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            People, relationships, and activity across the entire platform.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <Users className="w-5 h-5 text-[var(--brand-orange)] mb-2" />
            <p className="text-2xl font-black">{loading ? "—" : stats?.totalContacts || 0}</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total Contacts</p>
          </div>
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <UserPlus className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-2xl font-black">{loading ? "—" : stats?.pendingApprovals || 0}</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Pending Approvals</p>
          </div>
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <Activity className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-2xl font-black">—</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Active Programs</p>
          </div>
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
            <Clock className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-black">—</p>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">This Month</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "All People", href: "/admin/communications/contacts" },
            { label: "Pending Approvals", href: "/admin/pending-users" },
            { label: "Bulk Import", href: "/admin/bulk-upload" },
            { label: "Groups", href: "/admin/crm" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-center text-xs font-bold uppercase tracking-wider hover:border-[var(--brand-orange)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Recent Contacts */}
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
          <h2 className="text-sm font-black uppercase tracking-wider mb-4">Recent Contacts</h2>
          {loading ? (
            <p className="text-xs text-[var(--text-secondary)]">Loading...</p>
          ) : recentContacts.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] italic">
              No contacts yet. People will appear here as they join the platform.
            </p>
          ) : (
            <div className="space-y-2">
              {recentContacts.slice(0, 8).map((c) => (
                <Link
                  key={c.cid}
                  href={`/admin/crm/timeline?cid=${c.cid}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-tertiary transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold">{c.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{c.email}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-tertiary">
                    {c.role || "unassigned"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-[var(--text-secondary)] text-center italic">
          CRM Foundation — Phase 1. Timeline, roles, and 360° profiles coming in future phases.
        </p>
      </div>
    </DashboardLayout>
  );
}
