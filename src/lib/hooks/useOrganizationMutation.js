"use client";
import { useRef, useState } from "react";

export default function useOrganizationMutation(organizationId) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function mutate(url, method, body) {
    if (pending.current) return null;
    pending.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(url, { method, cache: "no-store", headers: {
        "Content-Type": "application/json", "X-Organization-Id": organizationId,
      }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success || result.organizationId !== organizationId) {
        setError(result.error || "errors.somethingWrong"); return null;
      }
      return result;
    } catch { setError("errors.somethingWrong"); return null; }
    finally { pending.current = false; setBusy(false); }
  }
  return { mutate, busy, error };
}
