"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppButton from "@/components/ui/AppButton";
import PageHero from "@/components/ui/PageHero";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const pickNda = (payload) => (payload?.success ? payload : null);

export default function InvestorNdaPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { data, loading, refresh } = useApi(`/api/investor/nda?lang=${lang === "fr" ? "fr" : "en"}`, {
    defaultValue: null,
    transform: pickNda,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/investor/nda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang === "fr" ? "fr" : "en",
          version: data?.nda?.version,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "errors.somethingWrong");
      await refresh();
      router.push("/investor/dashboard");
    } catch (_err) {
      setError(t("errors.somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <PageHero
        kicker={t("dashboardV2.kicker")}
        title={data?.nda?.title || t("dashboardV2.action.ndaTitle")}
        subtitle={t("dashboardV2.action.ndaHint")}
      />
      {loading && <p className="stf-small">{t("common.loading")}</p>}
      {data?.nda?.status === "draft" && (
        <p className="stf-card stf-small" role="status">
          {t("dashboardV2.ndaDraftBanner")}
        </p>
      )}
      {data?.nda?.body_md && (
        <article className="stf-card whitespace-pre-wrap text-sm text-[var(--text-primary)]">
          {data.nda.body_md}
        </article>
      )}
      {data?.terms?.body_md && (
        <article className="stf-card whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
          <h2 className="mb-2 font-bold text-[var(--text-primary)]">{data.terms.title}</h2>
          {data.terms.body_md}
        </article>
      )}
      {error && <p className="stf-small" role="alert">{error}</p>}
      <AppButton variant="primary" onClick={accept} disabled={busy || !data?.nda} loading={busy}>
        {t("dashboardV2.ndaAccept")}
      </AppButton>
    </div>
  );
}
