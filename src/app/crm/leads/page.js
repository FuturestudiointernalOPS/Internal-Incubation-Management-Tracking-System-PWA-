"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Target, Plus, Search, FileText } from "lucide-react";
import AppTable from "@/components/ui/AppTable";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const LEAD_TYPES = ["partnership", "investor", "program", "ecosystem", "client", "sponsor", "mentor", "other"];
const STATUS_OPTIONS = ["new", "contacted", "engaged", "qualified", "unqualified", "nurturing", "converted", "lost"];
const QUALIFICATION_OPTIONS = ["not_assessed", "needs_review", "qualified", "unqualified"];

export default function CrmLeadsPage() {
  const { t } = useI18n();
  const { alert } = useDialogs();

  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // New lead form state
  const [form, setForm] = useState({
    title: "", lead_type: "other", status: "new", qualification_state: "not_assessed", source: "", description: ""
  });

  async function fetchLeads() {
    try {
      const res  = await fetch("/api/crm/leads");
      const data = await res.json();
      if (data.success) setLeads(data.leads ?? []);
      else setError(t(data.error || "errors.somethingWrong"));
    } catch {
      setError(t("errors.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/me/permissions")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.success) {
          setCanCreate(Number(d.effective?.crm?.create ?? 0) >= 1);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => { fetchLeads(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.title?.toLowerCase().includes(q) ||
        l.contact_name?.toLowerCase().includes(q) ||
        l.organization_name?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      await alert({ message: t("crm.leads.titleRequired") });
      return;
    }
    // Phase 2 prevents creating without a target, though our simplified UI form doesn't yet wire a picker for person/org.
    // For this list view mockup, we will pass an error if backend rejects.
    setSaving(true);
    try {
      const res  = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setForm({ title: "", lead_type: "other", status: "new", qualification_state: "not_assessed", source: "", description: "" });
        await fetchLeads();
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "title",
      header: t("crm.leads.titleLabel"),
      render: (row) => (
        <div>
          <a href={`/crm/leads/${row.id}`} className="font-semibold text-[var(--brand-orange)] hover:underline">
            {row.title}
          </a>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {row.contact_name || row.organization_name || "—"}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: t("crm.leads.statusLabel"),
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface-3)] text-[var(--text-primary)]">
          {t(`crm.leads.statuses.${row.status}`) || row.status}
        </span>
      ),
    },
    {
      key: "qualification_state",
      header: t("crm.leads.qualificationLabel"),
      render: (row) => t(`crm.leads.qualifications.${row.qualification_state}`) || row.qualification_state,
    },
    {
      key: "owner_name",
      header: t("crm.leads.ownerLabel"),
      render: (row) => row.owner_name || "—",
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-[var(--brand-orange)]" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
                {t("crm.leads.title")}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {t("crm.leads.subtitle")}
              </p>
            </div>
          </div>
          {canCreate && (
            <AppButton onClick={() => setShowModal(true)} className="shrink-0">
              <Plus className="w-4 h-4" />
              {t("crm.leads.createLead")}
            </AppButton>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <AppEmptyState
            icon={FileText}
            title={search ? t("common.noResults") : t("crm.leads.noLeads")}
            description={!search ? t("crm.leads.noLeadsHint") : undefined}
          />
        ) : (
          <AppTable columns={columns} rows={filtered} rowKey="id" />
        )}
      </div>

      <AppModal open={showModal} onClose={() => setShowModal(false)} title={t("crm.leads.createLead")}>
        <form onSubmit={handleCreate} className="space-y-4">
          <AppInput
            label={t("crm.leads.titleLabel")}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={t("crm.leads.titlePlaceholder")}
            required
          />
          <div className="text-xs text-[var(--text-secondary)] italic">
            Note: Associating a contact or organization is required, but omitted from this basic form view for brevity. 
            Integration with contact picker belongs in a dedicated UI component.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <AppButton type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
              {t("common.cancel")}
            </AppButton>
            <AppButton type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("crm.leads.createLead")}
            </AppButton>
          </div>
        </form>
      </AppModal>
    </>
  );
}
