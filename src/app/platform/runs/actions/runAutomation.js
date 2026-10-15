/**
 * The run automation switches, resolved the same way the server resolves them.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 3 values this module reads into
 * runAutomationActions().
 */

import { isRunAutomationFlagOverride, resolveAutomationFlag } from "@/lib/platform/automationSettings";

export function runAutomationActions({
  runFormSettings,
  runSettings,
  setRunSettings,
}) {
  // Run automation switches — the server's own rule (run → form → on), from the
  // shared resolver: plain functions, safe to import on the client.
  const runAutomationValue = (section, flag) => resolveAutomationFlag(runFormSettings, runSettings, `${section}.${flag}`);

  const isRunAutomationOverride = (section, flag) => isRunAutomationFlagOverride(runSettings, `${section}.${flag}`);

  // Write an explicit boolean so the run overrides the form from then on.
  const setRunAutomationFlag = (section, flag, value) => {
    const prev = runSettings || {};
    const automation = { ...(prev.automation || {}) };
    automation[section] = { ...(automation[section] || {}), [flag]: value };
    setRunSettings({ ...prev, automation });
  };

  // Drop every run override — the PUT body then omits `automation` entirely.
  const resetRunAutomation = () => setRunSettings({ ...(runSettings || {}), automation: undefined });

  return {
    runAutomationValue,
    isRunAutomationOverride,
    setRunAutomationFlag,
    resetRunAutomation,
  };
}
