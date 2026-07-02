"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * REDIRECT: Developer Standup has been unified into /staff/op-report.
 * This page automatically redirects to the unified report page with the standup tab pre-selected.
 */
export default function DeveloperStandup() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/op-report?tab=standup");
  }, [router]);

  return null;
}
