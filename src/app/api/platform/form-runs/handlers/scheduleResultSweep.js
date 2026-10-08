import { after } from "next/server";
import { dispatchScheduledResultEmails } from "@/services/platform/formRuns";

/**
 * Ask for a sweep AFTER the current response has been written. Used on reads
 * (opening a run) and right after an approval, so a scheduled result never
 * waits on an external timer to exist — the timer only makes it punctual.
 */
const RESULT_SWEEP_COOLDOWN_MS = 2 * 60 * 1000;
const lastResultSweepAt = new Map();

export function scheduleResultSweep(runId = null) {
  const key = runId == null ? "*" : String(runId);
  const now = Date.now();
  if (now - (lastResultSweepAt.get(key) || 0) < RESULT_SWEEP_COOLDOWN_MS) return;
  lastResultSweepAt.set(key, now);
  after(() => dispatchScheduledResultEmails({ run_id: runId }).catch(() => {}));
}