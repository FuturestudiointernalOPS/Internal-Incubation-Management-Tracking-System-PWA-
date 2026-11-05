"use client";

import { Rocket } from "lucide-react";
import CreationAccessGuard from "@/components/create/CreationAccessGuard";
import AddVentureForm from "@/components/create/AddVentureForm";
import { useI18n } from "@/lib/i18n";

/**
 * CREATE → Venture — the same "Add a Venture" flow the Super Admin has:
 * the venture is recorded and its founder is invited by email. Available to
 * anyone holding `ventures.create`.
 */
export default function CreateVenturePage() {
  const { t } = useI18n();

  return (
    <CreationAccessGuard requirements={[{ module: "ventures", capability: "create" }]}>
      <div className="stf" style={{ paddingBottom: 60 }}>
        <div className="stf-head">
          <div>
            <h1 className="stf-title">{t("creation.venture.heading")}</h1>
            <p className="stf-sub">{t("creation.venture.subtitle")}</p>
          </div>
        </div>

        <div className="stf-card" style={{ maxWidth: 640 }}>
          <h3>
            <Rocket size={15} />
            {t("vadmin.list.addVentureTitle")}
          </h3>
          <AddVentureForm />
        </div>
      </div>
    </CreationAccessGuard>
  );
}
