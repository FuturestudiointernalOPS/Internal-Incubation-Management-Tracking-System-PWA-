"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Users, Search } from "lucide-react";
import AppTable from "@/components/ui/AppTable";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * CRM WORKSPACE — People directory (non-admin).
 *
 * The sidebar sub-section "Contacts" for users holding the CRM responsibility.
 * It is deliberately READ-ONLY: the admin CRM screens expose create/edit/
 * delete/invite controls, and those belong to the Super Admin workspace.
 * Visibility is double-checked server-side — GET /api/contacts requires the
 * `contacts.view` capability (resolver + CRM eligibility), and for a non-admin
 * it returns the role-appropriate subset, never the whole table.
 */

const ROLE_LABELS = {
  participant: "crm.roles.participant",
  staff: "crm.roles.staff",
  investor: "crm.roles.investor",
  finance: "crm.roles.finance",
  unassigned: "crm.roles.unassigned",
  team: "crm.roles.team",
  founder: "crm.roles.founder",
  pm: "crm.roles.pm",
};

const STATUS_LABELS = {
  active: "status.active",
  pending: "crm.contacts.pendingApproval",
  approved: "crm.contacts.statusApproved",
  inactive: "crm.contacts.statusInactive",
  archived: "status.archived",
};

export default function CrmContactsPage() {
  const { t } = useI18n();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/contacts");
        const data = await res.json();
        if (!alive) return;
        if (data.success) setContacts(data.contacts || []);
        else setError(t(data.error || "errors.somethingWrong"));
      } catch {
        if (alive) setError(t("errors.somethingWrong"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.role, c.group_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  // A missing key comes back as the key itself (visible signal) — fall back to
  // the raw value so a new role/status never renders a key to the user.
  const labelOr = (key, fallback) => {
    if (!key) return fallback ?? "—";
    const value = t(key);
    return value && value !== key ? value : (fallback ?? "—");
  };

  const columns = [
    { key: "name", label: t("crm.directory.columnName") },
    { key: "email", label: t("crm.directory.columnEmail") },
    {
      key: "role",
      label: t("crm.directory.columnRole"),
      render: (value) => labelOr(ROLE_LABELS[value], value),
    },
    {
      key: "group_name",
      label: t("crm.directory.columnGroup"),
      render: (value) => labelOr(null, value),
    },
    {
      key: "status",
      label: t("crm.directory.columnStatus"),
      render: (value) => {
        const label = labelOr(STATUS_LABELS[value], value);
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-tertiary text-[var(--text-secondary)]">
            {label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <header className="flex items-center gap-3 border-b border-[var(--border-primary)] pb-6">
        <Users className="w-6 h-6 text-[var(--brand-orange)]" />
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {t("crm.contacts.contactsTitle")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("crm.directory.subtitle")}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("crm.directory.searchPlaceholder")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-[var(--brand-orange)] transition-colors"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("crm.contacts.showingCount", { count: filtered.length })}
        </span>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm font-bold text-red-400">{error}</p>
        </div>
      )}

      <AppTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage={t("crm.contacts.noContactsFound")}
      />
    </div>
  );
}
