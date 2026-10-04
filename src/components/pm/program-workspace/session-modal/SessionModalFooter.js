"use client";

import { useI18n } from "@/lib/i18n";
import { Plus } from "lucide-react";

export default function SessionModalFooter({
  t,
  isSaving,
  newSession,
  kpis,
  onAddSession,
  onCloseSessionModal2,
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onCloseSessionModal2()}
        className="flex-1 btn btn-secondary"
      >
        {t("pmMisc.workspace.cancel")}
      </button>
      <button
        onClick={onAddSession}
        disabled={
          isSaving ||
          !newSession.title.trim() ||
          (kpis.length > 0 &&
            (!newSession.kpi_ids || newSession.kpi_ids.length === 0))
        }
        className="flex-1 btn btn-primary"
      >
        {isSaving
          ? t("pmMisc.workspace.creating")
          : t("pmMisc.workspace.createSession")}
      </button>
    </div>
  );
}