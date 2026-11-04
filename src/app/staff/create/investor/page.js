"use client";

import CreationAccessGuard from "@/components/create/CreationAccessGuard";
import InvestorInvitePanel from "@/components/create/InvestorInvitePanel";
import { useI18n } from "@/lib/i18n";

/**
 * CREATE → Investor — hand a prospective investor the application link. The
 * application is reviewed in Investor Management; approval creates the account.
 * Available to anyone holding `investor.create`.
 */
export default function CreateInvestorPage() {
  const { t } = useI18n();

  return (
    <CreationAccessGuard requirements={[{ module: "investor", capability: "create" }]}>
      <div className="stf" style={{ paddingBottom: 60 }}>
        <div className="stf-head">
          <div>
            <h1 className="stf-title">{t("creation.investor.heading")}</h1>
            <p className="stf-sub">{t("creation.investor.subtitle")}</p>
          </div>
        </div>

        <InvestorInvitePanel />
      </div>
    </CreationAccessGuard>
  );
}
