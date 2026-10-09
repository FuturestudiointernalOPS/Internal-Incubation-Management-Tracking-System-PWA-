"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Phone, Mail, Users, FileText, Repeat, SquareCheck, Loader2,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, Clock,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";

const ACTIVITY_ICONS = {
  call:       <Phone className="w-4 h-4" />,
  email:      <Mail className="w-4 h-4" />,
  meeting:    <Users className="w-4 h-4" />,
  note:       <FileText className="w-4 h-4" />,
  follow_up:  <Repeat className="w-4 h-4" />,
  task:       <SquareCheck className="w-4 h-4" />,
  other:      <Clock className="w-4 h-4" />,
};

const ACTIVITY_TYPE_OPTIONS = [
  { value: "call",      label: "crm.activities.types.call" },
  { value: "meeting",   label: "crm.activities.types.meeting" },
  { value: "email",     label: "crm.activities.types.email" },
  { value: "note",      label: "crm.activities.types.note" },
  { value: "follow_up", label: "crm.activities.types.follow_up" },
  { value: "task",      label: "crm.activities.types.task" },
  { value: "other",     label: "crm.activities.types.other" },
];

const OUTCOME_OPTIONS = [
  { value: "",           label: "crm.activities.outcomes.none" },
  { value: "positive",   label: "crm.activities.outcomes.positive" },
  { value: "neutral",    label: "crm.activities.outcomes.neutral" },
  { value: "negative",   label: "crm.activities.outcomes.negative" },
  { value: "no_response",label: "crm.activities.outcomes.no_response" },
  { value: "rescheduled",label: "crm.activities.outcomes.rescheduled" },
  { value: "completed",  label: "crm.activities.outcomes.completed" },
];

// Task rows carry native task statuses in the shared `outcome` column — those
// live in the status.* namespace, not in the CRM outcome vocabulary.
const TASK_STATUS_KEY = {
  pending:     "status.pending",
  in_progress: "status.inProgress",
  completed:   "status.completed",
  blocked:     "status.blocked",
  archived:    "status.archived",
};

function activityOutcomeLabel(activity, t) {
  if (activity.activity_type === "task") {
    const key = TASK_STATUS_KEY[activity.outcome];
    return key ? t(key) : activity.outcome;
  }
  return t(`crm.activities.outcomes.${activity.outcome}`);
}

const EMPTY_FORM = {
  type: "note",
  title: "",
  description: "",
  outcome: "",
  activity_date: new Date().toISOString().slice(0, 10),
};

/**
 * CrmActivityPanel
 *
 * Unified Activities + Next Action panel.
 * Accepts: leadId | opportunityId | contactCid | organizationId
 *
 * Reads crm_activities AND tasks (via the model union query) from
 * GET /api/crm/activities?lead_id=...
 *
 * Creating a task routes to POST /api/crm/leads/[leadId]/tasks
 * or POST /api/crm/opportunities/[opportunityId]/tasks.
 * Other activity types route to POST /api/crm/activities.
 */
export default function CrmActivityPanel({ leadId, opportunityId, contactCid, organizationId }) {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();

  const [activities, setActivities] = useState([]);
  const [nextAction, setNextAction] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState(null);   // existing activity or null
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [showAll, setShowAll]       = useState(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (leadId)        params.set("lead_id", leadId);
    if (opportunityId) params.set("opportunity_id", opportunityId);
    if (contactCid)    params.set("contact_cid", contactCid);
    if (organizationId) params.set("organization_id", organizationId);
    return params.toString();
  }, [leadId, opportunityId, contactCid, organizationId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/crm/activities?${buildQuery()}`);
      const data = await res.json();
      const list = data.activities ?? [];
      setActivities(list);

      // Derive Next Action: earliest upcoming, non-completed task or meeting
      const now = Date.now();
      const upcoming = list
        .filter(a => {
          if (!a.activity_date) return false;
          if (new Date(a.activity_date).getTime() < now) return false;
          if (a.activity_type === "task" && (a.outcome === "completed" || a.outcome === "cancelled")) return false;
          if (a.activity_type === "meeting" && (a.outcome === "completed" || a.outcome === "cancelled")) return false;
          return true;
        })
        .sort((a, b) => new Date(a.activity_date) - new Date(b.activity_date));
      setNextAction(upcoming[0] ?? null);
    } catch {
      // silently degrade — panel is non-critical
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(activity) {
    // Tasks are read-only from CRM (edit via native tasks)
    if (activity.activity_type === "task") return;
    setEditing(activity);
    setForm({
      type:          activity.activity_type,
      title:         activity.title ?? "",
      description:   activity.description ?? "",
      outcome:       activity.outcome ?? "",
      activity_date: activity.activity_date ? activity.activity_date.slice(0, 10) : "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      await alert({ message: t("crm.activities.titleRequired") });
      return;
    }
    setSaving(true);
    try {
      let res;
      if (editing) {
        res = await fetch(`/api/crm/activities/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:         form.title,
            description:   form.description,
            outcome:       form.outcome,
            activity_date: form.activity_date || null,
          }),
        });
      } else if (form.type === "task") {
        // Route to the appropriate task creation sub-endpoint
        const taskUrl = leadId
          ? `/api/crm/leads/${leadId}/tasks`
          : `/api/crm/opportunities/${opportunityId}/tasks`;
        res = await fetch(taskUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       form.title,
            description: form.description,
            end_date:    form.activity_date || null,
          }),
        });
      } else {
        res = await fetch("/api/crm/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type:          form.type,
            title:         form.title,
            description:   form.description,
            outcome:       form.outcome,
            activity_date: form.activity_date || null,
            lead_id:       leadId,
            opportunity_id: opportunityId,
            contact_cid:   contactCid,
            organization_id: organizationId,
          }),
        });
      }
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

  async function handleDelete(activity) {
    if (activity.activity_type === "task") return; // Tasks deleted via native UI
    const ok = await confirm({
      message: t("crm.activities.confirmDelete"),
      tone: "danger",
    });
    if (!ok) return;
    await fetch(`/api/crm/activities/${activity.id}`, { method: "DELETE" });
    await load();
  }

  const displayed = showAll ? activities : activities.slice(0, 5);

  // Tasks are created through the native task system and need a lead or
  // opportunity context endpoint — contact/organization-only panels cannot
  // create tasks, so the option is hidden for them.
  const canCreateTask = Boolean(leadId || opportunityId);
  const typeOptions = ACTIVITY_TYPE_OPTIONS.filter(
    (option) => option.value !== "task" || canCreateTask
  );

  return (
    <div className="space-y-6">
      {/* ── NEXT ACTION ── */}
      <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
          {t("crm.activities.nextAction")}
        </h2>
        {loading ? (
          <Skeleton className="h-6 w-48" />
        ) : nextAction ? (
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-[var(--brand-orange)]">
              {ACTIVITY_ICONS[nextAction.activity_type] ?? ACTIVITY_ICONS.other}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{nextAction.title}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {nextAction.activity_date
                  ? formatDate(new Date(nextAction.activity_date))
                  : "—"}{" "}
                {nextAction.owner_name ? `· ${nextAction.owner_name}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)] italic">
            {t("crm.activities.noNextAction")}
          </p>
        )}
      </div>

      {/* ── ACTIVITY LIST ── */}
      <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {t("crm.activities.title")}
          </h2>
          <AppButton size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            {t("crm.activities.addActivity")}
          </AppButton>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : activities.length === 0 ? (
          <AppEmptyState
            message={t("crm.activities.noActivities")}
            hint={t("crm.activities.noActivitiesHint")}
          />
        ) : (
          <>
            <ol className="space-y-3">
              {displayed.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 group"
                >
                  <span className="mt-0.5 shrink-0 text-[var(--text-secondary)]">
                    {ACTIVITY_ICONS[a.activity_type] ?? ACTIVITY_ICONS.other}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{a.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      <span className="capitalize">{t(`crm.activities.types.${a.activity_type}`) || a.activity_type}</span>
                      {a.activity_date ? ` · ${formatDate(new Date(a.activity_date))}` : ""}
                      {a.owner_name ? ` · ${a.owner_name}` : ""}
                      {a.outcome ? ` · ${activityOutcomeLabel(a, t)}` : ""}
                    </p>
                    {a.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {a.description}
                      </p>
                    )}
                  </div>
                  {a.activity_type !== "task" && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1 rounded hover:bg-[var(--surface-3)] text-[var(--text-secondary)]"
                        title={t("common.edit")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        className="p-1 rounded hover:bg-[var(--surface-3)] text-red-500"
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>

            {activities.length > 5 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="mt-4 text-xs text-[var(--text-secondary)] flex items-center gap-1 hover:text-[var(--text-primary)]"
              >
                {showAll ? (
                  <><ChevronUp className="w-3.5 h-3.5" /> {t("common.showLess")}</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5" /> {t("crm.activities.showAll", { count: activities.length })}</>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      <AppModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t("crm.activities.editActivity") : t("crm.activities.addActivity")}
        footer={
          <div className="flex justify-end gap-3">
            <AppButton variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>
              {t("common.cancel")}
            </AppButton>
            <AppButton onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
            </AppButton>
          </div>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <AppSelect
              label={t("crm.activities.typeLabel")}
              value={form.type}
              onChange={v => setForm(f => ({ ...f, type: v }))}
              options={typeOptions.map(o => ({
                value: o.value,
                label: t(o.label),
              }))}
            />
          )}

          <AppInput
            label={t("crm.activities.titleLabel")}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t("crm.activities.titlePlaceholder")}
          />

          <AppInput
            label={t("crm.activities.dateLabel")}
            type="date"
            value={form.activity_date}
            onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))}
          />

          {form.type !== "task" && (
            <AppSelect
              label={t("crm.activities.outcomeLabel")}
              value={form.outcome}
              onChange={v => setForm(f => ({ ...f, outcome: v }))}
              options={OUTCOME_OPTIONS.map(o => ({
                value: o.value,
                label: t(o.label),
              }))}
            />
          )}

          <AppInput
            label={t("crm.activities.descriptionLabel")}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder={t("crm.activities.descriptionPlaceholder")}
            multiline
            rows={3}
          />
        </div>
      </AppModal>
    </div>
  );
}
