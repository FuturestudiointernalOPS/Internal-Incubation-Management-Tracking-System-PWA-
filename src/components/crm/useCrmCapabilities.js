"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The connected user's CRM capabilities, for showing or hiding action buttons.
 * Visibility only — every CRM API authorizes the request again.
 *
 *   const { can } = useCrmCapabilities();
 *   {can("create") && <AppButton>…</AppButton>}
 */
export function useCrmCapabilities() {
  const [capabilities, setCapabilities] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me/permissions")
      .then((response) => response.json())
      .then((data) => {
        if (alive && data.success) setCapabilities(data.effective?.crm ?? {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const can = useCallback(
    (capability) => Number(capabilities?.[capability] ?? 0) >= 1,
    [capabilities],
  );

  return { can, loaded: capabilities !== null };
}
