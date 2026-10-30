import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  ensureCrmNextActionColumns,
  ensureCrmStageTargetColumn,
} from "@/models/crm/schema";
import { getCrmDashboard } from "@/services/crm/dashboard";
import { sweepCrmNotifications } from "@/services/crm/notifications";
import { sweepCrmTimeTriggers } from "@/services/crm/timeTriggers";

export const dynamic = "force-dynamic";

/**
 * GET /api/crm/dashboard — the CRM action dashboard (crm.view).
 *
 * Workspace-wide by decision: the perimeter is shared, never filtered by owner.
 * The composition and the definitions live in `@/services/crm/dashboard`.
 */
export const GET = createHandler(async () => {
  const authError = await requireAuthorization("crm", "view");
  if (authError) return authError;

  // The dashboard reads the next-action columns on every count, and the stuck
  // count reads each stage's target. A fresh environment may never have written
  // a next action, so the write paths never created those columns — ensure them
  // before the read (both idempotent, once per process).
  await ensureCrmNextActionColumns();
  await ensureCrmStageTargetColumn();

  // Refresh the in-app alerts. The sweep is idempotent per record, kind and day,
  // and throttled per process; a failure here must never break the dashboard.
  try {
    await sweepCrmNotifications();
  } catch (error) {
    console.warn("[crm/dashboard] notification sweep skipped:", error.message);
  }

  // Same clock for the time-based automation rules; same failure isolation.
  try {
    await sweepCrmTimeTriggers();
  } catch (error) {
    console.warn("[crm/dashboard] time-trigger sweep skipped:", error.message);
  }

  const dashboard = await getCrmDashboard();
  return NextResponse.json({ success: true, ...dashboard });
});
