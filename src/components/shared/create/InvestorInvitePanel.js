"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";

const EMPTY_LINK = { url: "", runId: null, loading: false, error: "" };

/**
 * The investor application link — the Super Admin's "Add Investor" feature.
 *
 * A person is never written directly: the link opens the canonical Investor
 * Application form, and approving the submission provisions the account. The
 * two endpoints keep their own gates server-side (`investor.create` for the
 * seed, `runs.edit` OR `investor.create` for the rotation).
 *
 * The error is kept as a translation KEY (the API answers with one), never as
 * already-translated text: that keeps the generator independent of the active
 * language, so switching language cannot re-mint the link.
 */
export default function InvestorInvitePanel() {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [link, setLink] = useState(EMPTY_LINK);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setCopied(false);
    setLink({ ...EMPTY_LINK, loading: true });
    try {
      const response = await fetch("/api/platform/seed/investor-application", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success && data.slug) {
        setLink({
          url: `${window.location.origin}/s/${data.slug}`,
          runId: data.run_id,
          loading: false,
          error: "",
        });
        return;
      }
      setLink({
        url: "",
        runId: null,
        loading: false,
        error: data.error || "investorAdmin.list.linkFailed",
      });
    } catch {
      setLink({
        url: "",
        runId: null,
        loading: false,
        error: "investorAdmin.list.linkFailed",
      });
    }
  }, []);

  // The page IS the link: one click mints it (the seed is idempotent, so this
  // always returns the same active run until it is deliberately rotated).

  const copyLink = async () => {
    if (!link.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      /* clipboard unavailable — the URL stays visible and selectable */
    }
  };

  const regenerate = async () => {
    if (!link.runId) return;
    if (!(await confirm({ message: t("investorAdmin.list.regenerateConfirm"), tone: "danger" }))) {
      return;
    }
    setCopied(false);
    setLink((previous) => ({ ...previous, loading: true, error: "" }));
    try {
      const response = await fetch("/api/platform/form-runs?action=regenerate_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: link.runId }),
      });
      const data = await response.json();
      if (data.success && data.public_slug) {
        setLink((previous) => ({
          ...previous,
          url: `${window.location.origin}/s/${data.public_slug}`,
          loading: false,
          error: "",
        }));
      } else {
        setLink((previous) => ({
          ...previous,
          loading: false,
          error: data.error || "investorAdmin.list.linkFailed",
        }));
      }
    } catch {
      setLink((previous) => ({
        ...previous,
        loading: false,
        error: "investorAdmin.list.linkFailed",
      }));
    }
  };

  return (
    <div className="stf-card" style={{ maxWidth: 640 }}>
      <h3>
        <UserPlus size={15} />
        {t("investorAdmin.list.addInvestor")}
      </h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
        {t("investorAdmin.list.addInvestorHint")}
      </p>

      {link.loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
        </div>
      ) : link.error ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-rose-400">{t(link.error)}</p>
          <AppButton variant="secondary" size="sm" icon={RefreshCw} onClick={generate}>
            {t("common.retry")}
          </AppButton>
        </div>
      ) : !link.url ? (
        <AppButton variant="primary" size="sm" icon={UserPlus} onClick={generate}>
          {t("investorAdmin.list.addInvestor")}
        </AppButton>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--surface-3)] border border-[var(--border-primary)]">
            <span className="flex-1 text-xs font-bold text-[var(--text-primary)] break-all">
              {link.url}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AppButton
              variant="primary"
              size="sm"
              icon={copied ? Check : Copy}
              onClick={copyLink}
            >
              {copied ? t("investorAdmin.list.linkCopied") : t("investorAdmin.list.copyLink")}
            </AppButton>
            <AppButton variant="secondary" size="sm" icon={RefreshCw} onClick={regenerate}>
              {t("investorAdmin.list.regenerateLink")}
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}
