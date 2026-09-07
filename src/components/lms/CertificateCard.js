"use client";

import { useState } from "react";
import { Award, Download } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";

/**
 * CERTIFICATE CARD — the learner's certificate for a completed course.
 *
 * Renders the authoritative certificate record returned by the server (never
 * client-composed content). The PDF is generated server-side from the same
 * record — this component only triggers the download and streams the bytes.
 */
export default function CertificateCard({ certificate }) {
  const { t, lang } = useI18n();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!certificate) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/lms/certificates/${certificate.id}/download`);
      if (!res.ok) {
        let key = "lms.certificate.downloadFailed";
        try {
          const json = await res.json();
          if (json && json.error) key = json.error;
        } catch {
          /* non-JSON error body — keep the generic key */
        }
        throw new Error(key);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${certificate.certificate_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify("success", "lms.certificate.downloaded");
    } catch (e) {
      notify("error", e.message || "lms.certificate.downloadFailed");
    } finally {
      setDownloading(false);
    }
  };

  const issuedLabel = formatDate(certificate.issued_at, lang);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
    >
      <div className="flex items-center gap-2 px-5 pt-4">
        <Award className="w-4 h-4" style={{ color: "var(--brand-orange)" }} />
        <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("lms.certificate.available")}
        </p>
      </div>

      {/* Certificate body */}
      <div
        className="mx-5 mt-3 mb-5 rounded-lg border-2 text-center px-4 py-6"
        style={{ borderColor: "var(--brand-orange)" }}
      >
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--brand-orange)" }}>
          {t("lms.certificate.title")}
        </p>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          {t("lms.certificate.certifiesThat")}
        </p>
        <p className="mt-1 text-lg font-black tracking-tight break-words" style={{ color: "var(--text-primary)" }}>
          {certificate.learner_name}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          {t("lms.certificate.hasCompleted")}
        </p>
        <p className="mt-1 text-sm font-black break-words" style={{ color: "var(--text-primary)" }}>
          {certificate.course_title}
        </p>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          {t("lms.certificate.issuedBy")}
        </p>
        <p className="mt-2 text-[10px] font-bold" style={{ color: "var(--text-tertiary)" }}>
          {t("lms.certificate.issued")}: {issuedLabel}
        </p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("lms.certificate.certificateId")}: {certificate.certificate_number}
        </p>
      </div>

      <div className="px-5 pb-5">
        <AppButton variant="primary" icon={Download} loading={downloading} onClick={download}>
          {t("lms.certificate.download")}
        </AppButton>
      </div>
    </div>
  );
}

function formatDate(value, lang) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang || "en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}
