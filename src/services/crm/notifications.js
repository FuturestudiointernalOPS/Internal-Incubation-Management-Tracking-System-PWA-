import {
  ensureCrmNotificationColumns,
  getCrmOverdueNotificationCandidates,
  getCrmDormantNotificationCandidates,
  getCrmStuckNotificationCandidates,
  findCrmNotification,
  createCrmNotification,
} from "@/models/crm/notifications";
import { STALE_AFTER_DAYS } from "@/services/crm/dashboard";

/**
 * CRM — in-app attention notifications (DECISION layer).
 *
 * Reuses the platform inbox: the bell every user already has. The recipient is
 * the RECORD'S OWNER — the person accountable for moving the relationship — and
 * a record with no owner produces nothing (there is nobody to hold accountable
 * yet; assigning an owner is the first fix).
 *
 * Each alert carries a template key and its parameters, so the bell renders it
 * in the reader's language (the stored title/message are an English fallback for
 * consumers that do not localize).
 *
 * The sweep is idempotent per record, kind and day: opening the CRM dashboard
 * twice, or two operators opening it at once, does not multiply the alerts.
 *
 * KNOWN LIMIT: there is no scheduler in this application, so the sweep is
 * triggered by reading the CRM dashboard. A team that never opens it receives
 * nothing; a real cron should call the same sweep later.
 */

/** At most one sweep per process per interval; the dedupe key handles the rest. */
export const NOTIFICATION_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_NOTIFICATIONS_PER_SWEEP = 50;

let lastSweepAt = 0;

const dayStamp = (now) => {
  const date = now instanceof Date ? now : new Date(now);
  return date.toISOString().slice(0, 10);
};

const isoDay = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
};

const linkFor = (entity, id) =>
  entity === "lead" ? `/crm/leads/${id}` : `/crm/opportunities/${id}`;

/** Build the notification payload for one candidate. */
function payloadFor(candidate) {
  if (candidate.kind === "overdue") {
    return {
      type: "crm_overdue",
      templateKey: "crm.notifications.overdue",
      title: "Overdue next action",
      message: `${candidate.name} — ${candidate.next_action} was due ${isoDay(candidate.due)}.`,
      params: {
        name: candidate.name,
        action: candidate.next_action,
        date: isoDay(candidate.due),
      },
      link: linkFor(candidate.entity, candidate.id),
    };
  }

  if (candidate.kind === "dormant") {
    return {
      type: "crm_dormant",
      templateKey: "crm.notifications.dormant",
      title: "Dormant opportunity",
      message: `${candidate.name} has had no activity for ${STALE_AFTER_DAYS} days.`,
      params: { name: candidate.name, days: STALE_AFTER_DAYS },
      link: linkFor("opportunity", candidate.id),
    };
  }

  return {
    type: "crm_stuck",
    templateKey: "crm.notifications.stuck",
    title: "Stuck in a stage",
    message: `${candidate.name} has been in ${candidate.stage_name} for ${candidate.days_in_stage} days (target ${candidate.target_days}).`,
    params: {
      name: candidate.name,
      stage: candidate.stage_name,
      days: Number(candidate.days_in_stage) || 0,
      target: Number(candidate.target_days) || 0,
    },
    link: linkFor("opportunity", candidate.id),
  };
}

/**
 * Create the missing attention notifications.
 *
 * @returns {Promise<{skipped: boolean, created: number, duplicates: number, unowned: number}>}
 */
export async function sweepCrmNotifications({ force = false, now = new Date() } = {}) {
  const nowMs = Date.now();
  if (!force && nowMs - lastSweepAt < NOTIFICATION_SWEEP_INTERVAL_MS) {
    return { skipped: true, created: 0, duplicates: 0, unowned: 0 };
  }
  lastSweepAt = nowMs;

  await ensureCrmNotificationColumns();

  const [overdue, dormant, stuck] = await Promise.all([
    getCrmOverdueNotificationCandidates(MAX_NOTIFICATIONS_PER_SWEEP),
    getCrmDormantNotificationCandidates(MAX_NOTIFICATIONS_PER_SWEEP),
    getCrmStuckNotificationCandidates(MAX_NOTIFICATIONS_PER_SWEEP),
  ]);

  const candidates = [
    ...(overdue.rows ?? []).map((row) => ({ ...row, kind: "overdue" })),
    ...(dormant.rows ?? []).map((row) => ({ ...row, kind: "dormant", entity: "opportunity" })),
    ...(stuck.rows ?? []).map((row) => ({ ...row, kind: "stuck", entity: "opportunity" })),
  ];

  const day = dayStamp(now);
  let created = 0;
  let duplicates = 0;
  let unowned = 0;

  for (const candidate of candidates.slice(0, MAX_NOTIFICATIONS_PER_SWEEP)) {
    // Nobody accountable yet: assigning an owner is the fix, not a notification.
    if (!candidate.owner_cid) {
      unowned += 1;
      continue;
    }

    const dedupeKey = `crm:${candidate.kind}:${candidate.entity}:${candidate.id}:${day}`;
    const existing = await findCrmNotification(candidate.owner_cid, dedupeKey);
    if (existing.rows?.length) {
      duplicates += 1;
      continue;
    }

    const payload = payloadFor(candidate);
    await createCrmNotification({
      recipientId: candidate.owner_cid,
      dedupeKey,
      ...payload,
    });
    created += 1;
  }

  return { skipped: false, created, duplicates, unowned };
}
