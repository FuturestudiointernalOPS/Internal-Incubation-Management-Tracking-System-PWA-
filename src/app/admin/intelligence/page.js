"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import IntelligenceView from "@/components/admin/intelligence/IntelligenceView";

export default function IntelligencePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { data, loading, error, refresh } = useApi("/api/intelligence/metrics", {
    defaultValue: null,
  });

  return (
    <IntelligenceView
      data={data}
      loading={loading}
      error={error}
      refresh={refresh}
      t={t}
      onNavigateVentures={() => router.push("/admin/ventures")}
    />
  );
}
