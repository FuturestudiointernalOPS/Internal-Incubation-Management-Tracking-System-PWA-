"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The connected user's capacity matrix, for showing or hiding actions.
 * Visibility only — every CRM API authorizes the request again.
 *
 *   const { can, cid, effective, isSuperAdmin } = useCrmCapabilities();
 *   {can("create") && <AppButton>…</AppButton>}
 *
 * `cid` is the caller's own contact id: the screens compare it with a record's
 * owner to show the owner-only actions (setting the next action).
 * `effective` is the whole matrix, so a screen that spans several modules (the
 * person record, whose tabs come from Programs, LMS, Membership…) can gate each
 * block on the module that actually protects it instead of inventing a new
 * capability.
 */
export function useCrmCapabilities() {
  const [state, setState] = useState({
    crm: null,
    effective: null,
    isSuperAdmin: false,
    cid: null,
  });

  useEffect(() => {
    let alive = true;
    fetch("/api/me/permissions")
      .then((response) => response.json())
      .then((data) => {
        if (!alive || !data.success) return;
        setState({
          crm: data.effective?.crm ?? {},
          effective: data.effective ?? {},
          isSuperAdmin: Boolean(data.isSuperAdmin),
          cid: data.cid ?? null,
        });
      })
      .catch(() => {
        // A failed read is a closed door, not a spinner forever: the screen
        // resolves with no capability instead of hanging.
        if (alive) {
          setState({ crm: {}, effective: {}, isSuperAdmin: false, cid: null });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const can = useCallback(
    (capability) => Number(state.crm?.[capability] ?? 0) >= 1,
    [state.crm],
  );

  const holds = useCallback(
    (moduleKey, capability = "view") =>
      state.isSuperAdmin ||
      Number(state.effective?.[moduleKey]?.[capability] ?? 0) >= 1,
    [state.effective, state.isSuperAdmin],
  );

  return {
    can,
    holds,
    loaded: state.effective !== null,
    cid: state.cid,
    effective: state.effective,
    isSuperAdmin: state.isSuperAdmin,
  };
}
