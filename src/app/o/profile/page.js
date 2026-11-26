"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppButton from "@/components/ui/AppButton";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import AppInput from "@/components/ui/AppInput";
import PageHero from "@/components/ui/PageHero";
import OrganizationPortalHeader from "@/components/ui/OrganizationPortalHeader";

export const dynamic = "force-dynamic";

// Personal identity only, served by the existing session-scoped profile API.
// No participant shell, programme reads or internal-role assignment required.
export default function ClientAccountProfilePage() {
  const { t } = useI18n();
  const router = useRouter();
  const context = useApi("/api/org/context", { cache: false, fetchOptions: { cache: "no-store" } });
  const { data, loading, error, status, refresh } = useApi("/api/profile", {
    cache: false, fetchOptions: { cache: "no-store" },
  });
  if (loading) return <AppEmptyState title={t("common.loading")} />;
  if (status === 401) return <AppEmptyState title={t("errors.authRequired")}
    action={<AppButton onClick={() => router.push("/login?next=%2Fo%2Fprofile")}>{t("common.organizationPortal.signIn")}</AppButton>} />;
  if (error || !data?.success || !data.profile) return <AppEmptyState title={t("errors.somethingWrong")}
    action={<AppButton onClick={refresh}>{t("common.retry")}</AppButton>} />;
  const profile = data.profile;
  return <div className="space-y-6">
    {context.data?.success && context.data.organization && <OrganizationPortalHeader organization={context.data.organization} activePage="profile" onBrandChanged={context.refresh} />}
    <PageHero title={t("common.workspaces.profile")} subtitle={t("common.organizationPortal.accountProfileHint")}
      action={<AppButton onClick={() => router.push("/o/select")}>{t("common.organizationPortal.clientWorkspaces")}</AppButton>} />
    <AppCard>
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput label={t("adminMisc.profile.fullName")} value={profile.name || ""} readOnly />
        <AppInput label={t("adminMisc.profile.email")} value={profile.email || ""} readOnly />
        <AppInput label={t("adminMisc.profile.phone")} value={profile.phone || ""} readOnly />
      </div>
    </AppCard>
  </div>;
}
