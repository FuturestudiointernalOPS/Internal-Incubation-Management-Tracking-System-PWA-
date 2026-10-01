export function cn(...classes) { return classes.filter(Boolean).join(" "); }

/** Human size for an attached document (512 B / 2 KB / 1.5 MB). */
export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${Number((value / (1024 * 1024)).toFixed(1))} MB`;
}

/**
 * Fetch the read-only result PDF for one submission. Reading a document has no
 * side effects: nothing is sent and nothing is recorded, so this may be called
 * as often as the user wants. Rejects with the server's own explanation when no
 * document can be produced (not evaluated yet, no usable recipient…).
 */
export async function fetchResultPdf(submissionId) {
  const response = await fetch("/api/platform/form-runs?action=preview_result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submission_id: submissionId }),
  });
  if (!response.ok) {
    let message = "";
    try {
      const data = await response.json();
      message = data?.error || "";
    } catch (_) {}
    throw new Error(message);
  }
  return response.blob();
}

// ─── Stable module-scope shapes ──────────────────────────────────────────────
// Built once here rather than on every render: the reading hook keys its internal
// work on these, and the respondent table reads EMPTY_SELECTION whenever the
// filter combination a selection was recorded under is not the current one, so a
// hidden selection is unreachable rather than merely invisible.

export const EMPTY_RUN_LIST = { runs: [], total: 0, failure: null };

export const EMPTY_SELECTION = [];

/**
 * A page of runs together with the message for a read that failed: the server's
 * own refusal, kept as the read's value rather than raised in the loader. A
 * request that never answered is reported by the hook's error, which the
 * notification beside the read folds back in.
 */
export const pickRunList = (response) =>
  response?.success
    ? { runs: response.runs || [], total: response.total || 0, failure: null }
    : { runs: [], total: 0, failure: response?.error || null };

/**
 * A stored answer, shown as text. Pure, so it lives at module scope: the answer
 * helpers below memoise their own identity, and a formatter captured from the
 * component body would change on every render and defeat that memoisation.
 */
export function fmtAnswer(answer) {
  if (answer === undefined || answer === null) return "";
  if (Array.isArray(answer)) {
    return answer.map((item) => {
      if (item === undefined || item === null) return "";
      if (typeof item === "object") return item.label || item.value || JSON.stringify(item);
      return String(item);
    }).filter(Boolean).join(", ");
  }
  if (typeof answer === "string") {
    try {
      if (answer.startsWith("{") && answer.includes('"code"')) {
        const parsedPhone = JSON.parse(answer);
        if (parsedPhone.code != null) return `${parsedPhone.code} ${parsedPhone.number || ""}`.trim();
      }
    } catch (_) {}
    return answer;
  }
  if (typeof answer === "object") {
    if (answer.label) return String(answer.label);
    if (answer.value) return String(answer.value);
    return JSON.stringify(answer);
  }
  return String(answer);
}

/** A submitter's account state, derived from the flags the row carries. Pure. */
/**
 * Payment state per SUBMISSION, keyed by submission id, read from the LMS
 * registrations of the selected Execution. Deliberately kept OUT of the run
 * detail read: the platform surface renders without the LMS tables, and the
 * run's own statement budget is untouched.
 */
export const pickPaymentsBySubmission = (payload) => {
  const bySubmission = {};
  if (payload?.success) {
    for (const row of payload.registrations || []) {
      if (row.submission_id != null) bySubmission[String(row.submission_id)] = row;
    }
  }
  return { bySubmission };
};

export function accountStatusOf(submission) {
  return (
    submission.account_status ||
    (submission.account_activated
      ? "active"
      : submission.account_created
        ? "activation_pending"
        : "not_created")
  );
}

/** "48 h", "1 h 30 min", "30 min" — empty for no delay. */
export function formatDelayLabel(t, minutes) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  if (total <= 0) return "";
  const parts = [];
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours > 0) parts.push(t("platformMisc.runs.resultDelayHoursShort", { count: hours }));
  if (remainder > 0) parts.push(t("platformMisc.runs.resultDelayMinutesShort", { count: remainder }));
  return parts.join(" ");
}
