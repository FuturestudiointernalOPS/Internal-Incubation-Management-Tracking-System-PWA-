/**
 * The toast every write reports through.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 1 names this module reads into toastActions().
 */

export function toastActions({
  setToast,
}) {
  const notify = (message, type = "success") => {
    setToast({ msg: message, type });
    setTimeout(() => setToast(null), 3500);
  };

  return {
    notify,
  };
}
