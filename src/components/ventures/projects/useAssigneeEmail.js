"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Give a name that only exists in the tracker an address to be reached at.
 *
 * It records an ADDRESS against the NAME — no person, member or account is
 * created and no platform access is granted (the `set_assignee_email` action of
 * the reminders route, gated on `ventures.edit`, so the server decides who may).
 * One address covers every activity that name owns or supports in the Venture.
 *
 * Returns `addEmail(name, { onDone })` and `savingName`, the name being saved.
 */
export function useAssigneeEmail(ventureId) {
  const { t } = useI18n();
  const { prompt, alert } = useDialogs();
  const [savingName, setSavingName] = useState(null);

  const addEmail = async (name, { onDone } = {}) => {
    const value = await prompt({
      title: t("venture.reminders.addEmailTitle"),
      message: t("venture.reminders.addEmailMessage", { name }),
      hint: t("venture.reminders.addEmailHint"),
      inputLabel: t("venture.reminders.email"),
      inputType: "email",
      placeholder: "name@example.com",
      confirmLabel: t("common.save"),
      required: true,
      validate: (input) => (EMAIL.test(String(input || "").trim()) ? null : t("venture.reminders.invalidEmail")),
    });
    if (!value) return false;

    setSavingName(name);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_assignee_email", display_name: name, email: String(value).trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.success) {
        await alert({ message: t(payload?.error || "errors.somethingWrong"), tone: "danger" });
        return false;
      }
      onDone?.();
      return true;
    } catch (_) {
      await alert({ message: t("errors.networkError"), tone: "danger" });
      return false;
    } finally {
      setSavingName(null);
    }
  };

  return { addEmail, savingName };
}
