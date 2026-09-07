"use client";

import { createContext, useContext } from "react";

/**
 * VentureWorkspace — shared context for founder Venture workspace tab
 * components (Phase 2 extraction).
 *
 * The page (src/app/participant/ventures/[id]/page.js) owns ALL state,
 * fetchers and handlers and provides them through this context under the
 * SAME identifiers the tab JSX used before extraction. Tab components
 * simply destructure what they need; no logic lives here.
 */
export const VentureWorkspace = createContext(null);

export function useVenture() {
  return useContext(VentureWorkspace);
}
