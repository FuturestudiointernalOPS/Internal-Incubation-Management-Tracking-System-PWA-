/**
 * The run automation switches, resolved the same way the server resolves them.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 3 values this module reads into
 * runAutomationActions().
 */



export function runAutomationActions({
  runFormSettings,
  runSettings,
  setRunSettings,
}) {
  // Run automation switches — same resolution order as the server (run → form →
  // on), computed locally so this screen never imports server code.
  const runAutomationValue = (section, flag) => {
    const runSettingValue = runSettings?.automation?.[section]?.[flag];
    if (typeof runSettingValue === "boolean") return runSettingValue;
    const formSettingValue = runFormSettings?.automation?.[section]?.[flag];
    if (typeof formSettingValue === "boolean") return formSettingValue;
    return true;
  };

  const isRunAutomationOverride = (section, flag) => typeof runSettings?.automation?.[section]?.[flag] === "boolean";

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
