"use client";

import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import PageHero from "@/components/ui/PageHero";

/** The dashboard's top banner: the date, the page title and the "new programme" button. */
export default function DashboardHeader({ onNewProgram }) {
  const { t, lang } = useI18n();
  return (
    <PageHero
      kicker={new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      title={t("admin.command")}
      subtitle={t("reports.operationalReports")}
      action={
        <button type="button" onClick={onNewProgram} className="stf-btn pr">
          <Plus size={15} /> {t("admin.newProgram")}
        </button>
      }
    />
  );
}
