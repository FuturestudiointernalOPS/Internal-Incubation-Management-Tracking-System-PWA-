"use client";

import { Plus, Trash2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import { useI18n } from "@/lib/i18n";

const LEAD_STATUSES = ["new", "contacted", "engaged", "qualified", "unqualified", "nurturing", "converted", "lost"];
const LEAD_TYPES = ["partnership", "investor", "program", "ecosystem", "client", "sponsor", "mentor", "other"];
const QUALIFICATION_STATES = ["not_assessed", "in_review", "qualified", "unqualified"];
const OPPORTUNITY_STATUSES = ["active", "won", "lost", "on_hold"];

/**
 * The fields a condition can test, per entity type. `values` + `valueKey` make
 * the value a choice among the known codes; `number` makes it numeric.
 * Exported so the action builder offers the same status codes.
 */
export const CONDITION_FIELDS = {
  lead: [
    { name: "status", values: LEAD_STATUSES, valueKey: "crm.leads.statuses" },
    { name: "lead_type", values: LEAD_TYPES, valueKey: "crm.leads.types" },
    { name: "qualification_state", values: QUALIFICATION_STATES, valueKey: "crm.intelligence.score.states" },
    { name: "score", number: true },
    { name: "source" },
  ],
  opportunity: [
    { name: "status", values: OPPORTUNITY_STATUSES, valueKey: "crm.opportunities.statuses" },
    { name: "value", number: true },
    { name: "probability", number: true },
    { name: "currency" },
  ],
};

// The operators the automation engine evaluates (services/crm/automationEngine).
const NUMBER_OPERATORS = ["equals", "greater_than", "greater_than_or_equal", "less_than"];
const CHOICE_OPERATORS = ["equals", "not_equals"];
const TEXT_OPERATORS = ["equals", "not_equals", "contains", "is_empty", "is_not_empty"];
const VALUELESS_OPERATORS = ["is_empty", "is_not_empty"];

function operatorsFor(field) {
  if (field?.number) return NUMBER_OPERATORS;
  if (field?.values) return CHOICE_OPERATORS;
  return TEXT_OPERATORS;
}

/** Conditions ready to store: complete rows only, numbers as numbers. */
export function cleanConditions(conditions, entityType) {
  const fields = CONDITION_FIELDS[entityType] ?? [];
  return (conditions ?? [])
    .map((condition) => {
      const field = fields.find((candidate) => candidate.name === condition.field);
      if (!field || !condition.operator) return null;
      if (VALUELESS_OPERATORS.includes(condition.operator)) {
        return { field: condition.field, operator: condition.operator };
      }
      if (condition.value === "" || condition.value == null) return null;
      return {
        field: condition.field,
        operator: condition.operator,
        value: field.number ? Number(condition.value) : condition.value,
      };
    })
    .filter(Boolean);
}

/**
 * CrmConditionBuilder — the "when" of a segment or an automation rule.
 *
 * Edits a list of { field, operator, value } rows; a record matches when ALL
 * rows hold. An empty list means "every record".
 */
export default function CrmConditionBuilder({ entityType, conditions, onChange }) {
  const { t } = useI18n();
  const fields = CONDITION_FIELDS[entityType] ?? [];

  const update = (index, changes) =>
    onChange(conditions.map((condition, position) => (position === index ? { ...condition, ...changes } : condition)));

  function addCondition() {
    const field = fields[0];
    onChange([...conditions, { field: field.name, operator: operatorsFor(field)[0], value: "" }]);
  }

  function changeField(index, name) {
    const field = fields.find((candidate) => candidate.name === name);
    update(index, { field: name, operator: operatorsFor(field)[0], value: "" });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          {t("crm.intelligence.conditions.title")}
        </p>
        <AppButton size="sm" variant="secondary" icon={Plus} onClick={addCondition}>
          {t("crm.intelligence.conditions.add")}
        </AppButton>
      </div>

      {conditions.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">{t("crm.intelligence.conditions.none")}</p>
      ) : (
        conditions.map((condition, index) => {
          const field = fields.find((candidate) => candidate.name === condition.field) ?? fields[0];
          const needsValue = !VALUELESS_OPERATORS.includes(condition.operator);
          return (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
              <AppSelect
                aria-label={t("crm.intelligence.conditions.fieldLabel")}
                value={condition.field}
                onChange={(event) => changeField(index, event.target.value)}
                options={fields.map((candidate) => ({
                  value: candidate.name,
                  label: t(`crm.intelligence.conditions.fields.${candidate.name}`),
                }))}
              />
              <AppSelect
                aria-label={t("crm.intelligence.conditions.operatorLabel")}
                value={condition.operator}
                onChange={(event) => update(index, { operator: event.target.value })}
                options={operatorsFor(field).map((operator) => ({
                  value: operator,
                  label: t(`crm.intelligence.conditions.operators.${operator}`),
                }))}
              />
              {!needsValue ? (
                <span />
              ) : field.values ? (
                <AppSelect
                  aria-label={t("crm.intelligence.conditions.valueLabel")}
                  value={condition.value ?? ""}
                  onChange={(event) => update(index, { value: event.target.value })}
                  placeholder={t("crm.intelligence.conditions.valueLabel")}
                  options={field.values.map((value) => ({ value, label: t(`${field.valueKey}.${value}`) }))}
                />
              ) : (
                <AppInput
                  aria-label={t("crm.intelligence.conditions.valueLabel")}
                  type={field.number ? "number" : "text"}
                  value={condition.value ?? ""}
                  onChange={(event) => update(index, { value: event.target.value })}
                  placeholder={t("crm.intelligence.conditions.valueLabel")}
                />
              )}
              <button
                type="button"
                onClick={() => onChange(conditions.filter((_, position) => position !== index))}
                aria-label={t("crm.intelligence.conditions.remove")}
                className="p-3 rounded-lg text-red-500 hover:bg-[var(--surface-3)]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
