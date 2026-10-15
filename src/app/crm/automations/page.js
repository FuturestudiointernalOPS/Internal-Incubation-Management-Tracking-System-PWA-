"use client";

import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Zap, History } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppTextarea from "@/components/ui/AppTextarea";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { useCrmCapabilities } from "@/components/crm/useCrmCapabilities";
import CrmConditionBuilder, { cleanConditions } from "@/components/crm/CrmConditionBuilder";
import CrmActionBuilder, { cleanActions } from "@/components/crm/CrmActionBuilder";
import { CrmAutomationExecutionsModal } from "@/components/crm/CrmRecordListModal";

export const dynamic = "force-dynamic";

const ENTITY_LABEL_KEYS = {
  lead: "crm.intelligence.common.lead",
  opportunity: "crm.intelligence.common.opportunity",
};

// The events each entity raises (lead and opportunity API routes).
const TRIGGERS = {
  lead: [
    { value: "lead.qualified", labelKey: "crm.intelligence.automations.triggerLeadQualified" },
    { value: "lead.disqualified", labelKey: "crm.intelligence.automations.triggerLeadDisqualified" },
    { value: "lead.score_changed", labelKey: "crm.intelligence.automations.triggerLeadScoreChanged" },
    { value: "lead.assigned", labelKey: "crm.intelligence.automations.triggerLeadAssigned" },
  ],
  opportunity: [
    { value: "opportunity.created", labelKey: "crm.intelligence.automations.triggerOpportunityCreated" },
    { value: "opportunity.stage_changed", labelKey: "crm.intelligence.automations.triggerOpportunityStageChanged" },
    { value: "opportunity.won", labelKey: "crm.intelligence.automations.triggerOpportunityWon" },
    { value: "opportunity.lost", labelKey: "crm.intelligence.automations.triggerOpportunityLost" },
  ],
};

export default function CrmAutomationsPage() {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();
  // Every automation endpoint — the list included — requires crm.manage.
  const { can } = useCrmCapabilities();
  const canManage = can("manage");

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({ 
    name: "", description: "", entity_type: "lead", trigger_event: "lead.qualified", conditions: [], actions: []
  });
  const [viewing, setViewing] = useState(null); // the rule whose execution log is shown

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/automations");
      const data = await res.json();
      if (data.success) setRules(data.rules);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", entity_type: "lead", trigger_event: "lead.qualified", conditions: [], actions: [] });
    setShowModal(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description || "",
      entity_type: r.entity_type,
      trigger_event: r.trigger_event,
      conditions: Array.isArray(r.conditions) ? r.conditions : [],
      actions: Array.isArray(r.actions) ? r.actions : [],
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      await alert({ message: t("crm.intelligence.automations.nameRequired") });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/crm/automations/${editing.id}` : "/api/crm/automations", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          conditions: cleanConditions(form.conditions, form.entity_type),
          actions: cleanActions(form.actions),
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        await load();
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r) {
    const ok = await confirm({
      message: t("crm.intelligence.automations.confirmDelete"),
      tone: "danger"
    });
    if (!ok) return;
    
    await fetch(`/api/crm/automations/${r.id}`, { method: "DELETE" });
    await load();
  }

  async function toggleActive(r) {
    await fetch(`/api/crm/automations/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active })
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {t("crm.intelligence.automations.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("crm.intelligence.automations.subtitle")}
          </p>
        </div>
        {canManage && (
          <AppButton icon={Plus} onClick={openCreate}>
            {t("crm.intelligence.automations.newRule")}
          </AppButton>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rules.length === 0 ? (
        <AppEmptyState
          icon={Zap}
          title={t("crm.intelligence.automations.noRules")}
          description={t("crm.intelligence.automations.noRulesHint")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules.map(r => (
            <div key={r.id} className={`bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${!r.active && 'opacity-60'}`}>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-[var(--surface-3)] text-[var(--brand-blue)]">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                    {r.name}
                    {!r.active && <span className="text-xs bg-[var(--surface-3)] px-2 py-0.5 rounded uppercase tracking-wider text-[var(--text-secondary)]">{t("crm.intelligence.automations.inactive")}</span>}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {r.description || t("crm.intelligence.common.noDescription")}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs font-mono text-[var(--text-secondary)]">
                    <span>{t("crm.intelligence.automations.on")}: {r.trigger_event}</span>
                    <span>{t("crm.intelligence.automations.entity")}: {t(ENTITY_LABEL_KEYS[r.entity_type] ?? r.entity_type)}</span>
                    <span>{t("crm.intelligence.conditions.count", { count: Array.isArray(r.conditions) ? r.conditions.length : 0 })}</span>
                    <span>{t("crm.intelligence.actions.count", { count: Array.isArray(r.actions) ? r.actions.length : 0 })}</span>
                  </div>
                </div>
              </div>
              {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <AppButton variant="ghost" onClick={() => toggleActive(r)}>
                  {r.active ? t("crm.intelligence.automations.disable") : t("crm.intelligence.automations.enable")}
                </AppButton>
                <button onClick={() => setViewing(r)} aria-label={t("crm.intelligence.automations.executions")} title={t("crm.intelligence.automations.executions")} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-3)] rounded">
                  <History className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(r)} aria-label={t("common.edit")} className="p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-3)] rounded">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(r)} aria-label={t("common.delete")} className="p-2 text-red-500 hover:bg-[var(--surface-3)] rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AppModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t("crm.intelligence.automations.editRule") : t("crm.intelligence.automations.newRule")}
        size="xl"
      >
        <div className="space-y-4">
          <AppInput
            label={t("crm.intelligence.automations.name")}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <AppTextarea
            label={t("crm.intelligence.automations.description")}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
          />
          {!editing && (
            <>
              <AppSelect
                label={t("crm.intelligence.automations.entityType")}
                value={form.entity_type}
                onChange={e => setForm(f => ({ ...f, entity_type: e.target.value, trigger_event: TRIGGERS[e.target.value][0].value, conditions: [], actions: [] }))}
                options={[
                  { value: "lead", label: t("crm.intelligence.common.lead") },
                  { value: "opportunity", label: t("crm.intelligence.common.opportunity") }
                ]}
              />
              <AppSelect
                label={t("crm.intelligence.automations.triggerEvent")}
                value={form.trigger_event}
                onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value }))}
                options={(TRIGGERS[form.entity_type] ?? []).map(trigger => ({ value: trigger.value, label: t(trigger.labelKey) }))}
              />
            </>
          )}
          <CrmConditionBuilder
            entityType={form.entity_type}
            conditions={form.conditions}
            onChange={conditions => setForm(f => ({ ...f, conditions }))}
          />
          <CrmActionBuilder
            entityType={form.entity_type}
            actions={form.actions}
            onChange={actions => setForm(f => ({ ...f, actions }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <AppButton variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>{t("common.cancel")}</AppButton>
            <AppButton onClick={handleSave} loading={saving}>
              {t("common.save")}
            </AppButton>
          </div>
        </div>
      </AppModal>

      {viewing && <CrmAutomationExecutionsModal rule={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
