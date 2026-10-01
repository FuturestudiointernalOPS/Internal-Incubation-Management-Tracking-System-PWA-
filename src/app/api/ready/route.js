import { NextResponse } from "next/server";
import { initDb, getPoolStats, getDbMetrics, pingDatabase } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * READINESS — "can this instance serve traffic?", i.e. is the database reachable
 * within a bounded time.
 *
 * Distinct from liveness on purpose: when this fails, the instance should be
 * taken OUT of rotation, not restarted. The probe is a single `SELECT 1` with its
 * own timeout, so a hung database degrades to a fast 503 rather than hanging the
 * health check itself (a hung health check reads as "healthy" to a naive
 * monitor).
 *
 * The body carries the numbers that make the pool auditable — active/idle/
 * waiting connections and the query-latency histogram — so "slow" can be
 * attributed to the query or to waiting for a connection.
 */

export const dynamic = "force-dynamic";

const DEFAULT_READY_TIMEOUT_MS = 3000;

/** Read per request so an operator can tune it without a code change. */
function readyTimeoutMs() {
  return Number(process.env.READY_TIMEOUT_MS) || DEFAULT_READY_TIMEOUT_MS;
}

/** Race a promise against a timer that is always cleared. */
async function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`probe timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function probeDatabase() {
  const started = Date.now();
  const timeoutMs = readyTimeoutMs();
  try {
    await initDb();
    await withTimeout(pingDatabase(), timeoutMs);
    return { ok: true, durationMs: Date.now() - started };
  } catch (error) {
    return { ok: false, durationMs: Date.now() - started, error: error.message };
  }
}

export async function GET() {
  const database = await probeDatabase();

  if (!database.ok) {
    logger.warn("readiness_failed", {
      durationMs: database.durationMs,
      error: database.error,
      pool: getPoolStats(),
    });
  }

  return NextResponse.json(
    {
      status: database.ok ? "ready" : "not_ready",
      checks: { database },
      pool: getPoolStats(),
      db: getDbMetrics(),
      timestamp: new Date().toISOString(),
    },
    { status: database.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
