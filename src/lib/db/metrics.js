/**
 * Database engine — process-wide instrumentation.
 *
 * Extracted from `lib/db.js` without change: the latency thresholds, the
 * per-process counters, the duration recorder, the slow-statement reporter and
 * the metrics snapshot. Pure module — it owns no pool and no connection state,
 * so it can be reasoned about (and tested) on its own. The pool's `waiting`
 * count is passed in by the caller that owns the pool.
 */

import { logger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";

/**
 * Latency thresholds. Calibrated to a ~130ms round trip on the current link:
 * under one round trip is normal, one to four is worth watching, four or more
 * is a defect to investigate. These are DEFAULTS — tune with DB_SLOW_MS /
 * DB_CRITICAL_MS rather than editing this file per environment.
 */
export const SLOW_QUERY_MS = Number(process.env.DB_SLOW_MS) || 500;
export const CRITICAL_QUERY_MS = Number(process.env.DB_CRITICAL_MS) || 1000;

/** Leading SQL keyword — the operation label a metric/log is grouped by. */
export const operationOf = (sql) => {
  const match = String(sql).trim().match(/^[a-z]+/i);
  return (match ? match[0] : "unknown").toUpperCase();
};

/**
 * Lightweight process counters, so the cost of a change can be measured
 * instead of guessed (see `scripts/db-roundtrip-report.mjs`):
 *   queries     — statements actually sent to the database
 *   skippedDdl  — maintenance statements answered locally instead of sent
 *   ddl         — maintenance statements that were sent
 *   dbMs        — accumulated time spent inside the database
 *   slow        — statements above the critical threshold
 *   slowWarn    — statements above the slow (but below critical) threshold
 *   maxMs       — slowest single statement observed this process
 *   histogram   — count of statements per latency band (for p50/p95 shape)
 */
export const metrics = {
  queries: 0,
  skippedDdl: 0,
  ddl: 0,
  dbMs: 0,
  slow: 0,
  slowWarn: 0,
  maxMs: 0,
  histogram: { lt100: 0, lt500: 0, lt1000: 0, gte1000: 0 },
  reset() {
    this.queries = 0;
    this.skippedDdl = 0;
    this.ddl = 0;
    this.dbMs = 0;
    this.slow = 0;
    this.slowWarn = 0;
    this.maxMs = 0;
    this.histogram = { lt100: 0, lt500: 0, lt1000: 0, gte1000: 0 };
  },
};

/** Record one statement's duration into the process counters. */
export const recordDuration = (duration) => {
  metrics.dbMs += duration;
  if (duration > metrics.maxMs) metrics.maxMs = duration;
  const h = metrics.histogram;
  if (duration < 100) h.lt100++;
  else if (duration < SLOW_QUERY_MS) h.lt500++;
  else if (duration < CRITICAL_QUERY_MS) h.lt1000++;
  else h.gte1000++;
};

/**
 * Log a slow statement as a structured event — never the SQL or the arguments,
 * which can carry personal data. The operation label plus the request id are
 * enough to find the offending call site in code.
 */
export const reportSlowQuery = (sql, duration, poolWaiting) => {
  const level = duration >= CRITICAL_QUERY_MS ? "error" : "warn";
  if (level === "error") metrics.slow++;
  else metrics.slowWarn++;
  logger[level](duration >= CRITICAL_QUERY_MS ? "db_slow_query" : "db_medium_query", {
    requestId: getRequestId(),
    operation: operationOf(sql),
    durationMs: duration,
    thresholdMs: duration >= CRITICAL_QUERY_MS ? CRITICAL_QUERY_MS : SLOW_QUERY_MS,
    poolWaiting,
  });
};

export const getDbMetrics = () => ({
  queries: metrics.queries,
  skippedDdl: metrics.skippedDdl,
  ddl: metrics.ddl,
  dbMs: metrics.dbMs,
  slow: metrics.slow,
  slowWarn: metrics.slowWarn,
  maxMs: metrics.maxMs,
  histogram: { ...metrics.histogram },
  avgMs: metrics.queries ? Math.round(metrics.dbMs / metrics.queries) : 0,
});
