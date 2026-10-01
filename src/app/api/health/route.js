import { NextResponse } from "next/server";

/**
 * LIVENESS — "is this process alive?", answered without touching a dependency.
 *
 * Deliberately cheap and dependency-free: a liveness probe that queries the
 * database turns a database hiccup into a process restart, which makes the
 * outage worse instead of surfacing it. Anything that needs the database is a
 * READINESS question — see `/api/ready`.
 *
 * Public by design (a load balancer holds no session cookie); it exposes no
 * data, only that the process is up.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "impactos",
      env: process.env.NODE_ENV || "unknown",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
