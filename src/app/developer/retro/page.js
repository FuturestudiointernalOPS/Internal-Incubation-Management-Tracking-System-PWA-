"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * REDIRECT: Developer Retro has been unified into /staff/op-report.
 * This page automatically redirects to the unified report page with the retro tab pre-selected.
 */
export default function DeveloperRetro() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/op-report?tab=retro");
  }, [router]);

  return null;
}
