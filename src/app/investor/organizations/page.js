"use client";

import { useState, useEffect } from "react";
import {
  Building2, Users, Plus, Loader2, ArrowLeft, Globe,
  Save, UserPlus, Crown, Shield, Mail, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";

export default function InvestorOrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", description: "", website: "" });

  // Selected org detail
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { fetchOrgs(); }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/investor/organizations");
      const data = await res.json();
      if (data.success) setOrgs(data.organizations || []);
    } catch (_) {}
    setLoading(false);
  };

  const fetchOrgDetail = async (orgId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/investor/organizations?id=${orgId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedOrg(data.organization);
        setOrgMembers(data.members || []);
      }
    } catch (_) {}
    setDetailLoading(false);
  };

  const handleCreate = async () => {
    if (!newOrg.name.trim()) {
      setToast({ type: "error", message: "Organization name is required" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/investor/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrg),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Organization created" });
        setShowCreate(false);
        setNewOrg({ name: "", description: "", website: "" });
        fetchOrgs();
      } else {
        setToast({ type: "error", message: data.error });
      }
    } catch (_) {}
    setSaving(false);
  };

  return (
    <DashboardLayout role="investor">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:text-[var(--brand-orange)]">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                Organizations
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                Manage your investor organizations and representatives
              </p>
            </div>
          </div>
          <AppButton variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            New Organization
          </AppButton>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : selectedOrg ? (
          /* ORGANIZATION DETAIL */
          <div className="space-y-4">
            <button onClick={() => setSelectedOrg(null)}
              className="text-xs font-bold text-[var(--brand-orange)] hover:underline uppercase tracking-wider flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to list
            </button>

            <AppCard padding="lg">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-7 h-7 text-[var(--brand-orange)]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-black text-[var(--text-primary)] uppercase">{selectedOrg.name}</h2>
                  {selectedOrg.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{selectedOrg.description}</p>
                  )}
                  {selectedOrg.website && (
                    <a href={selectedOrg.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--brand-blue)] hover:underline mt-2">
                      <Globe className="w-3 h-3" /> {selectedOrg.website}
                    </a>
                  )}
                </div>
              </div>
            </AppCard>

            {/* Members */}
            <AppCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--brand-orange)]" />
                  Members ({orgMembers.length})
                </h3>
              </div>
              {detailLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : orgMembers.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">No members yet</p>
              ) : (
                <div className="space-y-2">
                  {orgMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-3)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{m.name || m.organization_name || "—"}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">{m.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        m.role === "admin" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"
                      }`}>
                        {m.role === "admin" ? <Crown className="w-3 h-3 inline mr-1" /> : null}
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </AppCard>
          </div>
        ) : orgs.length === 0 ? (
          /* EMPTY STATE */
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">No Organizations</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-6">
              Create an organization to represent your VC firm, family office, or investment group.
            </p>
            <AppButton variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
              Create Organization
            </AppButton>
          </div>
        ) : (
          /* ORG LIST */
          <div className="space-y-3">
            {orgs.map(org => (
              <AppCard key={org.id} padding="md" hover onClick={() => fetchOrgDetail(org.id)}>
                <div className="flex items-center gap-4 cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{org.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Role: <span className="text-[var(--brand-orange)]">{org.member_role || "member"}</span>
                    </p>
                  </div>
                  {org.member_role === "admin" && (
                    <Crown className="w-4 h-4 text-amber-400" />
                  )}
                </div>
              </AppCard>
            ))}
          </div>
        )}

        {/* CREATE MODAL */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Create Organization</h3>
                <button onClick={() => setShowCreate(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-secondary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Name *</label>
                  <input value={newOrg.name} onChange={e => setNewOrg({...newOrg, name: e.target.value})}
                    placeholder="e.g. Future Capital Partners"
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Description</label>
                  <textarea value={newOrg.description} onChange={e => setNewOrg({...newOrg, description: e.target.value})}
                    rows={2} placeholder="Brief description of the organization..."
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 resize-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Website</label>
                  <input value={newOrg.website} onChange={e => setNewOrg({...newOrg, website: e.target.value})}
                    placeholder="https://..."
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-5">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-[var(--surface-3)]">
                  Cancel
                </button>
                <AppButton variant="primary" icon={Save} onClick={handleCreate} disabled={saving}>
                  {saving ? "Creating..." : "Create"}
                </AppButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
