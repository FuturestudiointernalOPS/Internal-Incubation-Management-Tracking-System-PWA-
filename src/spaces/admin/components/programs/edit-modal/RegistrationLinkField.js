"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Registration link (or the "no form yet" notice) for the edited programme. */
export default function RegistrationLinkField({ formUrl, formName }) {
  const { t } = useI18n();

  if (formUrl) {
    return (
      <div className="space-y-1.5">
        {formName && (
          <p className="text-[10px] font-bold uppercase text-[var(--text-primary)] ml-2 truncate">
            {formName}
          </p>
        )}
        <div className="flex items-center gap-2 bg-primary/50 rounded-xl px-1 py-1 border border-[var(--border-primary)]">
          <code
            className="flex-1 text-[10px] font-mono bg-black/30 px-4 py-3 rounded-xl border border-[var(--border-primary)] truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {formUrl}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(formUrl);
              window.dispatchEvent(
                new CustomEvent("impactos:notify", {
                  detail: {
                    type: "success",
                    message: t("adminMisc.programs.registrationLinkCopied"),
                  },
                }),
              );
            }}
            className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
            title={t("adminMisc.programs.copyRegistrationLink")}
          >
            <Copy className="w-4 h-4" />
          </button>
          <a
            href={formUrl}
            target="_blank"
            rel="noreferrer"
            className="p-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20"
            title={t("adminMisc.programs.openForm")}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
      <p className="text-[10px] font-bold uppercase text-amber-400">
        {t("adminMisc.programs.noFormYet")}
      </p>
      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
        {t("adminMisc.programs.noFormYetHint")}
      </p>
      <a
        href="/platform/forms"
        className="inline-block text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline"
      >
        {t("adminMisc.programs.goToCrmForms")}
      </a>
    </div>
  );
}
