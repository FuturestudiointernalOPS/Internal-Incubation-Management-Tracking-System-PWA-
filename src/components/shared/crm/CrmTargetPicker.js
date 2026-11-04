"use client";

import { useEffect, useMemo, useState } from "react";
import AppSelect from "@/components/ui/AppSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useI18n } from "@/lib/i18n";

// Where each kind of record is listed, and how a row becomes an option.
const SOURCES = {
  organization: {
    url: "/api/crm/organizations",
    rows: (data) => data.organizations,
    option: (row) => ({ value: String(row.id), label: row.name }),
  },
  contact: {
    url: "/api/contacts",
    rows: (data) => data.contacts,
    option: (row) => ({
      value: String(row.cid),
      label: row.email ? `${row.name || row.email} — ${row.email}` : row.name || String(row.cid),
    }),
  },
  lead: {
    url: "/api/crm/leads",
    rows: (data) => data.leads,
    option: (row) => ({ value: String(row.id), label: row.title }),
  },
};

/** The request field each kind is sent as. */
export const TARGET_FIELDS = {
  organization: "organization_id",
  contact: "contact_cid",
  lead: "lead_id",
};

/**
 * CrmTargetPicker — what a lead or an opportunity is attached to.
 *
 * A lead needs a person or an organization; an opportunity needs a lead, a
 * person or an organization. The picker lists the existing records of the
 * chosen kind, so the form always sends a target the API accepts.
 *
 * value / onChange: { kind, id } — `id` is "" until a record is chosen.
 */
export default function CrmTargetPicker({ kinds = ["organization", "contact"], value, onChange }) {
  const { t } = useI18n();
  const [options, setOptions] = useState({});
  const kindsKey = kinds.join(",");

  useEffect(() => {
    let alive = true;
    kindsKey.split(",").forEach(async (kind) => {
      const source = SOURCES[kind];
      try {
        const data = await (await fetch(source.url)).json();
        const rows = data.success ? source.rows(data) ?? [] : [];
        if (alive) setOptions((current) => ({ ...current, [kind]: rows.map(source.option) }));
      } catch {
        if (alive) setOptions((current) => ({ ...current, [kind]: [] }));
      }
    });
    return () => {
      alive = false;
    };
  }, [kindsKey]);

  const kindOptions = useMemo(
    () => kinds.map((kind) => ({ value: kind, label: t(`crm.target.kinds.${kind}`) })),
    [kinds, t],
  );

  const records = options[value.kind];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <AppSelect
        label={t("crm.target.label")}
        value={value.kind}
        onChange={(event) => onChange({ kind: event.target.value, id: "" })}
        options={kindOptions}
      />
      <div className="sm:col-span-2">
        <SearchableSelect
          label={t(`crm.target.kinds.${value.kind}`)}
          options={records ?? []}
          value={value.id}
          onChange={(id) => onChange({ kind: value.kind, id })}
          placeholder={records ? t(`crm.target.choose.${value.kind}`) : t("common.loading")}
          searchPlaceholder={t("common.search")}
          emptyText={t(`crm.target.empty.${value.kind}`)}
        />
      </div>
    </div>
  );
}
