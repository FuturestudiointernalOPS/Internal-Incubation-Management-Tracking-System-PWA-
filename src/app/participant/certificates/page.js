"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Award, Loader2 } from "lucide-react";

/**
 * PARTICIPANT CERTIFICATES — certificates issued to the current user
 * (participant_programs with certificate_issued = true). Empty state when none.
 */
export default function ParticipantCertificatesPage() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [certificates, setCertificates] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
    fetch("/api/participant/certificates")
      .then((r) => r.json())
      .then((d) => setCertificates(d.success ? d.certificates || [] : []))
      .catch(() => setCertificates([]))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "");

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
          {t("navigation.certificates")}
        </h1>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
            </div>
          ) : certificates && certificates.length > 0 ? (
            certificates.map((c) => (
              <div
                key={c.program_id}
                className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)]"
              >
                <Award className="w-5 h-5 text-[var(--brand-orange)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[var(--text-primary)]">
                    {c.program_name}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mt-1">
                    {t("participant.certificateIssued")}
                    {c.completed_at || c.accepted_at
                      ? ` · ${fmt(c.completed_at || c.accepted_at)}`
                      : ""}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                {t("participant.certificatesEmpty")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
