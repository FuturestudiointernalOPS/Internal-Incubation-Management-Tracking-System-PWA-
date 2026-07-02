"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeveloperErrors() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/engineering/error-logs");
  }, [router]);

  return null;
}
