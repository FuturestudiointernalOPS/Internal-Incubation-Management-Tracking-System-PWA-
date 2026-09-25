"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import Image from "next/image";
import { AlertTriangle, Clock, CreditCard, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const KKIAPAY_SCRIPT_URL = "https://cdn.kkiapay.me/k.js";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

function loadKkiapayScript() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.openKkiapayWidget) return Promise.resolve(true);
  if (!window.__kkiapayCheckoutScript) {
    window.__kkiapayCheckoutScript = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = KKIAPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve(Boolean(window.openKkiapayWidget));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return window.__kkiapayCheckoutScript;
}

/**
 * RESUME CHECKOUT — the destination of the "finish your registration" link.
 *
 * Reached ONLY with a token we emailed to the owner of the registration, which
 * is the single case where an EXISTING reference is allowed to reach a browser.
 * The reference is used as the payment window's `partnerId`; the server still
 * decides, after verification, whether the money settled.
 */
export default function ResumeCheckoutPage({ params }) {
  const { token } = use(params);
  const { t } = useI18n();

  const [stage, setStage] = useState("loading");
  const [context, setContext] = useState(null);
  const timer = useRef(null);

  const stopPolling = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const settleAccess = useCallback(async (reference, email) => {
    try {
      const response = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "access", reference, email }),
      });
      const payload = await response.json();
      if (payload.success && payload.served && payload.url) {
        window.location.href = payload.url;
        return;
      }
    } catch (_) {}
    setStage("paid");
  }, []);

  const poll = useCallback(
    (reference, email) => {
      const startedAt = Date.now();
      const tick = async () => {
        try {
          const response = await fetch(
            `/api/public/checkout?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`,
          );
          const payload = await response.json();
          if (payload.success && payload.payment === "paid") {
            await settleAccess(reference, email);
            return;
          }
          if (payload.success && ["failed", "cancelled"].includes(payload.payment)) {
            setStage("failed");
            return;
          }
        } catch (_) {}
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setStage("pending");
          return;
        }
        timer.current = setTimeout(tick, POLL_INTERVAL_MS);
      };
      tick();
    },
    [settleAccess],
  );

  const openWidget = useCallback(
    async (data) => {
      const ready = await loadKkiapayScript();
      if (!ready || !data.payment?.key) {
        setStage("unavailable");
        return;
      }

      if (typeof window.addSuccessListener === "function") {
        window.addSuccessListener((result) => {
          const transactionId = result?.transactionId || result?.transaction_id || null;
          if (transactionId) {
            fetch("/api/public/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "hint", reference: data.reference, transactionId }),
            }).catch(() => {});
          }
          stopPolling();
          setStage("verifying");
          poll(data.reference, data.email);
        });
      }
      if (typeof window.addFailedListener === "function") {
        window.addFailedListener(() => {
          stopPolling();
          setStage("failed");
        });
      }

      window.openKkiapayWidget({
        amount: data.amount,
        key: data.payment.key,
        sandbox: data.payment.sandbox,
        email: data.email,
        partnerId: data.reference,
      });

      // The server is the only source of truth; ask from now on.
      stopPolling();
      setStage("verifying");
      poll(data.reference, data.email);
    },
    [poll, stopPolling],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/public/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "continue", token }),
        });
        const payload = await response.json();

        if (!active) return;
        if (!payload.success) {
          setStage("invalid");
          return;
        }
        if (payload.paid) {
          // Nothing to pay — only an access to finish.
          setStage("verifying");
          await settleAccess(payload.reference, payload.email);
          return;
        }
        if (!payload.payment?.configured) {
          setStage("unavailable");
          return;
        }
        setContext(payload);
        await openWidget(payload);
      } catch (_) {
        if (active) setStage("invalid");
      }
    })();
    return () => {
      active = false;
      stopPolling();
    };
  }, [token, openWidget, settleAccess, stopPolling]);

  const displayAmount = context?.display_amount ?? context?.amount ?? 0;
  const amountLabel = `${Number(displayAmount).toLocaleString()} ${context?.currency || ""}`.trim();

  const panel = (icon, title, body) => (
    <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-5">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-xl font-black text-white uppercase tracking-tight">{title}</h1>
      {body ? <p className="text-sm text-slate-400 leading-relaxed">{body}</p> : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center">
          <Image
            src="/brand/logo_full.png"
            alt="Future Studio"
            width={1018}
            height={1024}
            className="h-12 w-auto object-contain"
          />
        </div>

        {displayAmount ? (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
              <CreditCard className="w-4 h-4" /> {t("forms.paymentAmount")}
            </span>
            <span className="text-lg font-black text-orange-400">{amountLabel}</span>
          </div>
        ) : null}

        {(stage === "loading" || stage === "verifying") &&
          panel(<Loader2 className="w-9 h-9 animate-spin text-orange-500" />, t("forms.paymentVerifying"), t("forms.paymentVerifyingHint"))}

        {stage === "pending" &&
          panel(<Clock className="w-9 h-9 text-slate-500" />, t("forms.paymentPending"), t("forms.paymentPendingBody"))}

        {stage === "paid" &&
          panel(<Clock className="w-9 h-9 text-slate-500" />, t("forms.paymentSuccess"), t("forms.paymentEmailNote"))}

        {stage === "failed" &&
          panel(<AlertTriangle className="w-9 h-9 text-rose-500" />, t("forms.paymentFailed"), t("forms.paymentFailedBody"))}

        {stage === "unavailable" &&
          panel(<AlertTriangle className="w-9 h-9 text-slate-500" />, t("forms.paymentUnavailable"), t("forms.paymentUnavailableBody"))}

        {stage === "invalid" &&
          panel(<AlertTriangle className="w-9 h-9 text-rose-500" />, t("forms.resumeInvalid"), t("forms.resumeInvalidBody"))}
      </div>
    </div>
  );
}
