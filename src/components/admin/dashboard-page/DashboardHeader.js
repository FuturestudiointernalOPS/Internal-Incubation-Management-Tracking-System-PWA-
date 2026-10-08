"use client";

import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The dashboard's top banner: the date, the page title and the
 * "new programme" button.
 */
export default function DashboardHeader({ onNewProgram }) {
  const { t, lang } = useI18n();
  return (
    <div className="stf-hero">
      <div>
        <div className="stf-k">
          {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
        <h2>{t("admin.command")}</h2>
        <p>{t("reports.operationalReports")}</p>
      </div>
      <button type="button" onClick={onNewProgram} className="stf-btn pr">
        <Plus size={15} /> {t("admin.newProgram")}
      </button>
    </div>
  );
}
