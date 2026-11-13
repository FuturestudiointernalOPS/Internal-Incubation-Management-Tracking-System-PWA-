"use client";

import { Plus, Trash2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import { useI18n } from "@/lib/i18n";
import { CONDITION_FIELDS } from "./CrmConditionBuilder";

// The action types the automation engine executes (services/crm/automationEngine).
const ACTION_TYPES = ["create_task", "add_timeline_event", "update_field"];
const TASK_PRIORITIES = ["low", "medium", "high"];

const EMPTY_PAYLOAD = {
  create_task: { title: "", priority: "medium" },
  add_timeline_event: { title: "", description: "" },
  update_field: { status: "" },
};

/** Actions ready to store: only those the engine can run as written. */
export function cleanActions(actions) {
  return (actions ?? [])
    .map((action) => {
      const payload = action.payload ?? {};
      if (action.type === "update_field") {
        return payload.status ? { type: action.type, payload: { status: payload.status } } : null;
      }
      const title = (payload.title ?? "").trim();
      if (!ACTION_TYPES.includes(action.type) || !title) return null;
      return action.type === "create_task"
        ? { type: action.type, payload: { title, priority: payload.priority || "medium" } }
        : { type: action.type, payload: { title, description: (payload.description ?? "").trim() } };
    })
    .filter(Boolean);
}

/**
 * CrmActionBuilder — the "then" of an automation rule: what runs, in order,
 * when the trigger fires and the conditions hold.
 */
export default function CrmActionBuilder({ entityType, actions, onChange }) {
  const { t } = useI18n();
  const statusField = (CONDITION_FIELDS[entityType] ?? []).find((field) => field.name === "status");

  const update = (index, changes) =>
    onChange(actions.map((action, position) => (position === index ? { ...action, ...changes } : action)));
  const updatePayload = (index, changes) =>
    update(index, { payload: { ...actions[index].payload, ...changes } });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("crm.intelligence.actions.title")}
        </p>
        <AppButton
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={() => onChange([...actions, { type: "create_task", payload: { ...EMPTY_PAYLOAD.create_task } }])}
        >
          {t("crm.intelligence.actions.add")}
        </AppButton>
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">{t("crm.intelligence.actions.none")}</p>
      ) : (
        actions.map((action, index) => (
          <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
            <AppSelect
              aria-label={t("crm.intelligence.actions.typeLabel")}
              value={action.type}
              onChange={(event) =>
                update(index, { type: event.target.value, payload: { ...EMPTY_PAYLOAD[event.target.value] } })
              }
              options={ACTION_TYPES.map((type) => ({ value: type, label: t(`crm.intelligence.actions.types.${type}`) }))}
            />
            {action.type === "update_field" ? (
              <>
                <AppSelect
                  aria-label={t("crm.intelligence.actions.statusLabel")}
                  value={action.payload?.status ?? ""}
                  onChange={(event) => updatePayload(index, { status: event.target.value })}
                  placeholder={t("crm.intelligence.actions.statusLabel")}
                  options={(statusField?.values ?? []).map((value) => ({
                    value,
                    label: t(`${statusField.valueKey}.${value}`),
                  }))}
                />
                <span />
              </>
            ) : (
              <>
                <AppInput
                  aria-label={t("crm.intelligence.actions.titleLabel")}
                  value={action.payload?.title ?? ""}
                  onChange={(event) => updatePayload(index, { title: event.target.value })}
                  placeholder={t("crm.intelligence.actions.titleLabel")}
                />
                {action.type === "create_task" ? (
                  <AppSelect
                    aria-label={t("crm.intelligence.actions.priorityLabel")}
                    value={action.payload?.priority ?? "medium"}
                    onChange={(event) => updatePayload(index, { priority: event.target.value })}
                    options={TASK_PRIORITIES.map((priority) => ({
                      value: priority,
                      label: t(`crm.intelligence.actions.priorities.${priority}`),
                    }))}
                  />
                ) : (
                  <AppInput
                    aria-label={t("crm.intelligence.actions.noteLabel")}
                    value={action.payload?.description ?? ""}
                    onChange={(event) => updatePayload(index, { description: event.target.value })}
                    placeholder={t("crm.intelligence.actions.noteLabel")}
                  />
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => onChange(actions.filter((_, position) => position !== index))}
              aria-label={t("crm.intelligence.actions.remove")}
              className="p-3 rounded-lg text-red-500 hover:bg-[var(--surface-3)]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}
