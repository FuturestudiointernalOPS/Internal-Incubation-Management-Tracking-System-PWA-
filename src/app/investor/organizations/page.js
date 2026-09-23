"use client";

import { useState } from "react";
import {
  Building2, Users, Plus, Loader2, ArrowLeft, Globe,
  Save, Crown, Shield, X,
} from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi, cacheGet, cacheSet } from "@/lib/hooks/useApi";

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickOrganizations = (response) => (response?.success ? response.organizations || [] : []);

export default function InvestorOrganizationsPage() {
  const goBack = useSafeBack("/investor");
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", description: "", website: "" });

  // Selected org detail
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no list state of its own and never sets state from an effect. Creating an
  // organisation calls refresh(), which bypasses the cache like bypassCache did.
  // The per-organisation detail below stays a click-driven loader of its own.
  const { data: orgs, loading, refresh } = useApi("/api/investor/organizations", {
    defaultValue: [],
    transform: pickOrganizations,
  });

  const fetchOrgDetail = async (orgId, bypassCache = false) => {
    setDetailLoading(true);
    try {
      const url = `/api/investor/organizations?id=${orgId}`;
      const applyDetail = (data) => {
        if (data.success) {
          setSelectedOrg(data.organization);
          setOrgMembers(data.members || []);
        }
      };
      // Cache-first paint: reopening a previously viewed organization renders
      // instantly from a fresh snapshot of its detail.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          applyDetail(cached);
          setDetailLoading(false);
        }
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        applyDetail(data);
      }
    } catch (_) {}
    setDetailLoading(false);
  };

  const handleCreate = async () => {
    if (!newOrg.name.trim()) {
      setToast({ type: "error", message: t("investorMisc.organizations.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/investor/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrg),
      });
      const data = await response.json();
      if (data.success) {
        setToast({ type: "success", message: t("investorMisc.organizations.created") });
        setShowCreate(false);
        setNewOrg({ name: "", description: "", website: "" });
        refresh();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (_) {}
    setSaving(false);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={goBack} className="p-2 hover:text-[var(--brand-orange)]">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                {t("investorMisc.organizations.title")}
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {t("investorMisc.organizations.subtitle")}
              </p>
            </div>
          </div>
          <AppButton variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            {t("investorMisc.organizations.newOrganization")}
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
              <ArrowLeft className="w-3 h-3" /> {t("investorMisc.organizations.backToList")}
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
                  {t("investorMisc.organizations.membersCount", { count: orgMembers.length })}
                </h3>
              </div>
              {detailLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : orgMembers.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)]">{t("investorMisc.organizations.noMembersYet")}</p>
              ) : (
                <div className="space-y-2">
                  {orgMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-3)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)]/10 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{member.name || member.organization_name || "—"}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">{member.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        member.role === "admin" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"
                      }`}>
                        {member.role === "admin" ? <Crown className="w-3 h-3 inline mr-1" /> : null}
                        {member.role}
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
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">{t("investorMisc.organizations.emptyTitle")}</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mb-6">
              {t("investorMisc.organizations.emptyDesc")}
            </p>
            <AppButton variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
              {t("investorMisc.organizations.createOrganization")}
            </AppButton>
          </div>
        ) : (
          /* ORG LIST */
          <div className="space-y-3">
            {orgs.map(organization => (
              <AppCard key={organization.id} padding="md" hover onClick={() => fetchOrgDetail(organization.id)}>
                <div className="flex items-center gap-4 cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{organization.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      {t("investorMisc.organizations.role")}: <span className="text-[var(--brand-orange)]">{organization.member_role || t("investorMisc.organizations.member")}</span>
                    </p>
                  </div>
                  {organization.member_role === "admin" && (
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
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">{t("investorMisc.organizations.createOrganization")}</h3>
                <button onClick={() => setShowCreate(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-secondary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.organizations.name")}</label>
                  <input value={newOrg.name} onChange={event => setNewOrg({...newOrg, name: event.target.value})}
                    placeholder={t("investorMisc.organizations.namePlaceholder")}
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.organizations.description")}</label>
                  <textarea value={newOrg.description} onChange={event => setNewOrg({...newOrg, description: event.target.value})}
                    rows={2} placeholder={t("investorMisc.organizations.descriptionPlaceholder")}
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.organizations.website")}</label>
                  <input value={newOrg.website} onChange={event => setNewOrg({...newOrg, website: event.target.value})}
                    placeholder="https://..."
                    className="w-full mt-1.5 px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-5">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-[var(--surface-3)]">
                  {t("investorMisc.organizations.cancel")}
                </button>
                <AppButton variant="primary" icon={Save} onClick={handleCreate} disabled={saving}>
                  {saving ? t("investorMisc.organizations.creating") : t("investorMisc.organizations.create")}
                </AppButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
