"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, User } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppSelect from "@/components/ui/AppSelect";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";

const RELATIONSHIP_TYPES = ["works_for", "founded", "advises", "represents", "invested_in", "partners_with", "other"];
const EMPTY_FORM = { contact_cid: "", relationship_type: "works_for", title: "" };

/**
 * CrmOrganizationPeopleModal — the people linked to one organization.
 *
 * Lists the existing links and, with the matching capability, links another
 * person (crm.create) or removes a link (crm.delete). Removing a link deletes
 * neither the person nor the organization.
 */
export default function CrmOrganizationPeopleModal({ organization, can, onClose }) {
  const { t } = useI18n();
  const { alert, confirm } = useDialogs();
  const [people, setPeople] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const canLink = can("create");

  const loadPeople = useCallback(async () => {
    try {
      const data = await (await fetch(`/api/crm/organizations/${organization.id}`)).json();
      setPeople(data.success ? data.contacts ?? [] : []);
    } catch {
      setPeople([]);
    }
  }, [organization.id]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  useEffect(() => {
    if (!canLink) return undefined;
    let alive = true;
    fetch("/api/contacts")
      .then((response) => response.json())
      .then((data) => {
        if (!alive || !data.success) return;
        setContacts(
          (data.contacts ?? []).map((contact) => ({
            value: String(contact.cid),
            label: contact.email ? `${contact.name || contact.email} — ${contact.email}` : contact.name || String(contact.cid),
          })),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [canLink]);

  async function handleLink(event) {
    event.preventDefault();
    if (!form.contact_cid) {
      await alert({ message: t("crm.relationships.personRequired") });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/contacts/${encodeURIComponent(form.contact_cid)}/organizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organization.id,
          relationship_type: form.relationship_type,
          title: form.title.trim() || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setForm(EMPTY_FORM);
        await loadPeople();
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(link) {
    if (!(await confirm({ message: t("crm.relationships.confirmRemove"), tone: "danger" }))) return;
    try {
      const response = await fetch(
        `/api/crm/contacts/${encodeURIComponent(link.contact_cid)}/organizations/${link.id}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (data.success) await loadPeople();
      else await alert({ message: t(data.error || "errors.somethingWrong") });
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    }
  }

  return (
    <AppModal isOpen onClose={onClose} title={`${organization.name} — ${t("crm.organizations.people")}`} size="lg">
      <div className="space-y-6">
        {people === null ? (
          <Skeleton className="h-16 w-full" />
        ) : people.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t("crm.relationships.noPeople")}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-primary)]">
            {people.map((link) => (
              <li key={link.id} className="py-2 flex items-center gap-3">
                <User className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {link.contact_name || link.contact_email || link.contact_cid}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {t(`crm.relationships.types.${link.relationship_type}`)}
                    {link.title ? ` · ${link.title}` : ""}
                  </p>
                </div>
                {can("delete") && (
                  <button
                    onClick={() => handleRemove(link)}
                    aria-label={`${t("crm.relationships.removeRelationship")} — ${link.contact_name || link.contact_cid}`}
                    className="p-2 rounded text-red-500 hover:bg-[var(--surface-3)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canLink && (
          <form onSubmit={handleLink} className="space-y-3 pt-4 border-t border-[var(--border-primary)]">
            <SearchableSelect
              label={t("crm.relationships.linkPerson")}
              options={contacts}
              value={form.contact_cid}
              onChange={(cid) => setForm((current) => ({ ...current, contact_cid: cid }))}
              placeholder={t("crm.target.choose.contact")}
              searchPlaceholder={t("common.search")}
              emptyText={t("crm.target.empty.contact")}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AppSelect
                label={t("crm.relationships.relationshipTypePlaceholder")}
                value={form.relationship_type}
                onChange={(event) => setForm((current) => ({ ...current, relationship_type: event.target.value }))}
                options={RELATIONSHIP_TYPES.map((type) => ({ value: type, label: t(`crm.relationships.types.${type}`) }))}
              />
              <AppInput
                label={t("crm.relationships.titleLabel")}
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={t("crm.relationships.titlePlaceholder")}
              />
            </div>
            <div className="flex justify-end">
              <AppButton type="submit" loading={saving}>
                {t("crm.relationships.linkPerson")}
              </AppButton>
            </div>
          </form>
        )}
      </div>
    </AppModal>
  );
}
