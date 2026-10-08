/**
 * The confirmation dialog's confirm.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 2 names this module reads into confirmActions().
 */

export function confirmActions({
  confirmTarget,
  setConfirmTarget,
}) {
  const handleConfirmAction = () => {
    confirmTarget.onConfirm();
    setConfirmTarget(null);
  };

  return {
    handleConfirmAction,
  };
}
