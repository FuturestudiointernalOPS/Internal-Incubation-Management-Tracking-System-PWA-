"use client";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { formatLocaleDate } from "@/lib/constants";
import AppCard from "@/components/ui/AppCard";
import AppTable from "@/components/ui/AppTable";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import CertificateCard from "@/components/lms/CertificateCard";
const pickCertificates = payload => payload?.success ? payload.certificates || [] : [];
const pickCourses = payload => payload?.success ? payload.courses || [] : [];

export default function ParticipantCertificatesPage() {
  const { t, lang } = useI18n();
  const { data: certificates, loading, error } = useApi("/api/participant/certificates", { defaultValue: [], transform: pickCertificates });
  const { data: courses, loading: coursesLoading } = useApi("/api/lms/my-learning", { defaultValue: [], transform: pickCourses });
  const issuedCourses = courses.filter(entry => entry.certificate);
  return <div className="p-6 space-y-6 max-w-6xl mx-auto">
    <header><h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("navigation.certificates")}</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{t("participant.template.certificateHint")}</p></header>
    <div className="grid grid-cols-2 gap-4">{[[t("participant.template.certificates"), certificates.length + issuedCourses.length], [t("participant.template.coursesInProgress"), courses.filter(entry => !entry.progress?.complete).length]].map(([label, count]) => <AppCard key={label} padding="sm"><p className="text-xs text-[var(--text-secondary)]">{label}</p><strong className="block mt-3 text-3xl font-bold font-mono text-[var(--text-primary)]">{loading || coursesLoading ? t("common.loading") : count}</strong></AppCard>)}</div>
    {error && <p role="alert" className="text-sm text-[var(--text-secondary)]">{t("errors.networkError")}</p>}
    <AppTable loading={loading} data={certificates.map(certificate => ({ ...certificate, id: certificate.program_id }))} emptyMessage={t("participant.certificatesEmpty")} columns={[
      { key: "program_name", label: t("participant.template.certificateTitle") },
      { key: "date", label: t("participant.template.issuedAt"), render: (_, certificate) => formatLocaleDate(certificate.completed_at || certificate.accepted_at, { day: "numeric", month: "long", year: "numeric" }, lang) },
      { key: "status", label: t("participant.template.statusColumn"), render: () => <AppStatusBadge status="completed" label={t("participant.certificateIssued")} /> },
    ]} />
    {issuedCourses.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{issuedCourses.map(entry => <CertificateCard key={entry.certificate.id} certificate={entry.certificate} />)}</div>}
  </div>;
}
