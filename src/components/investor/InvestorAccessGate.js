"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const ALLOWED_WITHOUT_NDA = [
  "/investor/nda",
  "/investor/setup-password",
  "/investor/onboarding",
];

/**
 * Phase 6 — when `investor_nda_v1` is on, block every investor surface until
 * the current NDA version is accepted (Guide §13.4).
 */
export default function InvestorAccessGate({ children }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { t } = useI18n();
  const [state, setState] = useState({ loading: true, redirecting: false });

  useEffect(() => {
    let cancelled = false;
    const allowed = ALLOWED_WITHOUT_NDA.some((path) => pathname.startsWith(path));

    (async () => {
      try {
        const response = await fetch("/api/investor/dashboard", { cache: "no-store" });
        const json = await response.json();
        if (cancelled) return;

        const features = json?.features || {};
        const profile = json?.profile || null;
        const activeVersion = json?.activeNdaVersion || null;
        const ndaRequired = Boolean(
          features.nda
          && (!profile?.nda_accepted_at
            || (activeVersion && profile?.nda_version !== activeVersion)),
        );

        if (ndaRequired && !allowed) {
          setState({ loading: false, redirecting: true });
          router.replace("/investor/nda");
          return;
        }

        if (
          features.onboarding
          && profile
          && !profile.onboarding_completed_at
          && !pathname.startsWith("/investor/onboarding")
          && !ndaRequired
        ) {
          setState({ loading: false, redirecting: true });
          router.replace("/investor/onboarding");
          return;
        }

        setState({ loading: false, redirecting: false });
      } catch (_) {
        if (!cancelled) setState({ loading: false, redirecting: false });
      }
    })();

    return () => { cancelled = true; };
  }, [pathname, router]);

  if (state.loading || state.redirecting) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
        <p className="stf-small">{t("common.loading")}</p>
      </div>
    );
  }

  return children;
}
