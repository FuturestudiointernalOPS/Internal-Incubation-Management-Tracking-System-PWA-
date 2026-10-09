"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search, Globe, Briefcase } from "lucide-react";
import AppTable from "@/components/ui/AppTable";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const ORG_TYPES = [
  "company",
  "ngo",
  "school",
  "fund",
  "government",
  "other",
];

const RELATIONSHIP_TYPES = [
  "works_for",
  "founded",
  "advises",
  "represents",
  "invested_in",
  "partners_with",
  "other",
];

/**
 * CRM Organizations page — /crm/organizations
 *
 * READ-ONLY list for non-admin CRM users (crm.view).
 * Create is available to users with crm.create (checked server-side on POST).
 * Full edit/delete stays in /admin/crm for Super Admin.
 */
export default function CrmOrganizationsPage() {
  const { t } = useI18n();
  const { alert } = useDialogs();

  const [orgs, setOrgs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // New org form state
  const [form, setForm] = useState({
    name: "", type: "", website: "", industry: "", description: "",
  });

  // ── Fetch organizations ──────────────────────────────────────────────────
  async function fetchOrgs() {
    try {
      const res  = await fetch("/api/crm/organizations");
      const data = await res.json();
      if (data.success) setOrgs(data.organizations ?? []);
      else setError(t(data.error || "errors.somethingWrong"));
    } catch {
      setError(t("errors.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }

  // ── Check crm.create permission ──────────────────────────────────────────
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

  useEffect(() => { fetchOrgs(); }, []);

  // ── Search filter ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name?.toLowerCase().includes(q) ||
        o.industry?.toLowerCase().includes(q) ||
        o.type?.toLowerCase().includes(q),
    );
  }, [orgs, search]);

  // ── Create org ───────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      await alert({ message: t("crm.organizations.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const res  = await fetch("/api/crm/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setForm({ name: "", type: "", website: "", industry: "", description: "" });
        await fetchOrgs();
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSaving(false);
    }
  }

  // ── Table columns ────────────────────────────────────────────────────────
  const columns = [
    {
      key: "name",
      header: t("crm.organizations.namePlaceholder"),
      render: (row) => (
        <span className="font-semibold text-[var(--text-primary)]">{row.name}</span>
      ),
    },
    {
      key: "type",
      header: t("crm.organizations.typePlaceholder"),
      render: (row) =>
        row.type ? t(`crm.organizations.types.${row.type}`) || row.type : "—",
    },
    {
      key: "industry",
      header: t("crm.organizations.industryPlaceholder"),
      render: (row) => row.industry || "—",
    },
    {
      key: "website",
      header: t("crm.organizations.websitePlaceholder"),
      render: (row) =>
        row.website ? (
          <a
            href={row.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--brand-orange)] hover:underline text-xs"
          >
            <Globe className="w-3 h-3" />
            {row.website.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-[var(--brand-orange)]" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
                {t("crm.organizations.title")}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {t("crm.organizations.subtitle")}
              </p>
            </div>
          </div>
          {canCreate && (
            <AppButton
              onClick={() => setShowModal(true)}
              className="shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t("crm.organizations.newOrganization")}
            </AppButton>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("crm.directory.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <AppEmptyState
            icon={Briefcase}
            title={search ? t("common.noResults") : t("crm.organizations.noOrganizations")}
            description={!search ? t("crm.organizations.noOrganizationsHint") : undefined}
          />
        ) : (
          <AppTable columns={columns} rows={filtered} rowKey="id" />
        )}
      </div>

      {/* Create modal */}
      <AppModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={t("crm.organizations.newOrganization")}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <AppInput
            label={t("crm.organizations.namePlaceholder")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("crm.organizations.namePlaceholder")}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wide">
              {t("crm.organizations.typePlaceholder")}
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40"
            >
              <option value="">—</option>
              {ORG_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`crm.organizations.types.${type}`)}
                </option>
              ))}
            </select>
          </div>

          <AppInput
            label={t("crm.organizations.websitePlaceholder")}
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="https://example.com"
            type="url"
          />

          <AppInput
            label={t("crm.organizations.industryPlaceholder")}
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            placeholder={t("crm.organizations.industryPlaceholder")}
          />

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wide">
              {t("crm.organizations.descriptionPlaceholder")}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t("crm.organizations.descriptionPlaceholder")}
              rows={3}
              className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/40 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <AppButton
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </AppButton>
            <AppButton type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("crm.organizations.newOrganization")}
            </AppButton>
          </div>
        </form>
      </AppModal>
    </>
  );
}
