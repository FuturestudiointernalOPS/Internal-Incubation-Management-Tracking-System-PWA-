"use client";

import StandupRetroView from "@/components/dashboard/StandupRetroView";
import { useI18n } from "@/lib/i18n";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

export default function StaffTasksPage() {
  const { t } = useI18n();
  // The identity comes from the shell's session cache instead of the browser's
  // stored copy, so nothing is written from an effect. It is absent for the first
  // moment of a cold load; the empty object keeps the view's existing contract
  // while that arrives.
  const { user } = useSessionUser();

  return (
    <>
      <StandupRetroView
        user={user || {}}
        context={{ context_type: "staff", context_id: null }}
        contextLabel={t("staffMisc.standupRetro.contextLabel")}
      />
    </>
  );
}
