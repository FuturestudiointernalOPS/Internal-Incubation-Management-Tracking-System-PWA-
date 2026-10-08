/**
 * The request body the workspace's configuration save sends.
 *
 * Built outside the screen so the page only names the write; the field list and
 * every fallback are exactly the ones the page wrote inline before the split.
 */
export function buildProgramConfigPayload({
  id,
  user,
  program,
  configNameRef,
  configDescRef,
  configWeeksRef,
  configStatusRef,
  configStartRef,
  configEndRef,
  configGradingRef,
}) {
  return {
    id,
    name:
      user.role === "super_admin" ? configNameRef.current?.value : program?.name,
    description: configDescRef.current?.value,
    duration_weeks:
      parseInt(configWeeksRef.current?.value) || program?.duration_weeks,
    status: configStatusRef.current?.value,
    note_id: program?.note_id,
    assigned_pm_id: program?.assigned_pm_id,
    assigned_assistant_id: program?.assigned_assistant_id,
    materials: program?.materials,
    start_date: configStartRef.current?.value,
    end_date: configEndRef.current?.value,
    grading_mode: configGradingRef.current?.value || "graded",
  };
}
