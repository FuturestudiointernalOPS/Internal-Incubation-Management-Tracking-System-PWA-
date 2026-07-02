"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeveloperStandup() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/staff/op-report");
  }, [router]);

  return null;
}
