"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The investor activity overview now lives on the investors dashboard
 * (section A). The old address keeps working: it forwards there, so old
 * bookmarks never 404.
 */
export default function InvestorOverviewRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/investors/dashboard");
  }, [router]);
  return null;
}
