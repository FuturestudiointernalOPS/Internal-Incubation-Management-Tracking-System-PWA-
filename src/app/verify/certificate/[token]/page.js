"use client";

import { useParams } from "next/navigation";
import { BadgeCheck, ShieldAlert, SearchX, Loader2, Award } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

export const dynamic = "force-dynamic";

/**
 * PUBLIC CERTIFICATE VERIFICATION — /verify/certificate/[token]
 *
 * No authentication required. Renders ONLY the deliberately public certificate
 * fields returned by /api/verify/certificate/[token] (number, learner name,
 * course title, issue date, status). Uses text labels for the status — never
 * color alone (accessibility).
 */

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop. An unknown, revoked-invalid or failed lookup all collapse to `null`,
// which the screen renders as "not found".
const pickVerifiedCertificate = (payload) =>
  payload?.success && payload.certificate ? payload.certificate : null;

export default function VerifyCertificatePage() {
  const params = useParams();
  const token = params.token;
  const { t, lang } = useI18n();
  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no state of its own and never sets state from an effect.
  const { data: certificate, loading } = useApi(
    `/api/verify/certificate/${encodeURIComponent(token)}`,
    { transform: pickVerifiedCertificate, deps: [token] },
  );
  const notFound = !loading && !certificate;

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
            <Award className="w-6 h-6" style={{ color: "var(--brand-orange)" }} />
          </div>
          <h1 className="mt-3 text-lg font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
            {t("lms.certificate.verificationTitle")}
          </h1>
        </div>

        <div
          className="rounded-2xl border p-6 sm:p-8"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {t("common.loading")}
              </p>
            </div>
          ) : notFound ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <SearchX className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {t("lms.certificate.notFound")}
              </p>
            </div>
          ) : (
            <CertificateResult certificate={certificate} t={t} lang={lang} />
          )}
        </div>
      </div>
    </main>
  );
}

function CertificateResult({ certificate, t, lang }) {
  const revoked = certificate.status === "revoked";
  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={{
          background: revoked ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
          borderColor: revoked ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)",
        }}
      >
        {revoked ? (
          <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: "var(--chart-danger)" }} />
        ) : (
          <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: "var(--chart-success)" }} />
        )}
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: revoked ? "var(--chart-danger)" : "var(--chart-success)" }}>
          {revoked ? t("lms.certificate.revokedTitle") : t("lms.certificate.verified")}
        </p>
      </div>

      <Field label={t("lms.certificate.certificateId")} value={certificate.certificate_number} t={t} />
      <Field label={t("lms.certificate.learner")} value={certificate.learner_name} t={t} />
      <Field label={t("lms.certificate.course")} value={certificate.course_title} t={t} />
      <Field label={t("lms.certificate.issued")} value={formatDate(certificate.issued_at, lang)} t={t} />
      <Field label={t("lms.certificate.status")} value={t(revoked ? "lms.certificate.revoked" : "lms.certificate.valid")} t={t} />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-3" style={{ borderColor: "var(--border-primary)" }}>
      <span className="text-[10px] font-black uppercase tracking-wider pt-0.5" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span className="text-xs font-black text-right break-words max-w-[60%]" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function formatDate(value, lang) {
  if (!value) return "";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang || "en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsedDate);
  } catch {
    return "";
  }
}
