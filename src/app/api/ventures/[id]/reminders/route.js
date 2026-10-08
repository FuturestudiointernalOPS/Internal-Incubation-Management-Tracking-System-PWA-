import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import { buildWorkItems } from "@/services/workItems";
import { deleteAssigneeEmail, upsertAssigneeEmail } from "@/models/ventureAssigneeEmails";
import {
  deleteReminderRule,
  insertReminderRule,
  selectReminderLog,
  selectReminderRules,
  setReminderRuleActive,
} from "@/models/ventureReminders";
import { getVentureNameByIdOrCode } from "@/models/ventureWorkspace";
import { sendManualReminder } from "@/services/reminders/engine";
import { normalizeEmail, resolveWorkItemRecipients } from "@/services/reminders/recipients";
import { normalizeDaysBefore, normalizeRuleKind, REMINDER_TRIGGERS } from "@/services/reminders/rules";

export const dynamic = "force-dynamic";

/**
 * /api/ventures/[id]/reminders — the reminder rules, history and sends of ONE
 * Venture (Phase 2).
 *
 *   GET  ?work_item=activity:41   the rules, the history, and — for one work
 *                                 item — exactly who a reminder would reach
 *   POST { action }               "send" | "add_rule" | "toggle_rule" |
 *                                 "delete_rule" | "set_assignee_email" |
 *                                 "clear_assignee_email"
 *
 * Reads are gated on `ventures.view`, writes on `ventures.edit` — the same pair
 * the work-items read uses, so whoever may manage a Venture's work may chase it,
 * and nobody gains a new kind of access by doing so. A Venture Manager is held to
 * their own Ventures by the scope half of that gate.
 *
 * The decisions live in `@/services/reminders`; this file owns the gate, the
 * address, the request shape and the response envelope. It writes to the reminder
 * tables and the addresses on file, and NEVER to Venture work.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const [rulesResult, logResult] = await Promise.all([
      selectReminderRules(id).catch(() => ({ rows: [] })),
      selectReminderLog(id).catch(() => ({ rows: [] })),
    ]);

    // For ONE work item, say who a reminder would actually reach — including
    // anyone it could not, so the screen can offer to add an address instead of
    // reporting a send that would reach nobody.
    const workItemParam = new URL(req.url).searchParams.get("work_item");
    let recipients = null;
    let workItem = null;
    if (workItemParam) {
      const { items } = await buildWorkItems({ dbId, ventureCode: id });
      workItem = items.find((item) => item.id === workItemParam) || null;
      if (workItem) {
        recipients = await resolveWorkItemRecipients({
          ventureId: id,
          item: workItem,
          includeOwner: true,
          includeSupporting: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      rules: rulesResult.rows || [],
      history: (logResult.rows || []).map((row) => ({
        ...row,
        // "Manual or automatic" is the question a manager actually asks of a
        // history row, and a null rule is what makes it manual.
        mode: row.rule_id === null ? "manual" : "automatic",
      })),
      work_item: workItemParam ? workItemParam : null,
      recipients,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ── Send one reminder now ────────────────────────────────────────────────
    if (action === "send") {
      const { items } = await buildWorkItems({ dbId, ventureCode: id });
      const item = items.find((entry) => entry.id === String(body?.work_item || ""));
      if (!item) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

      const nameResult = await getVentureNameByIdOrCode(id).catch(() => ({ rows: [] }));
      const ventureName =
        nameResult.rows?.[0]?.company_name || nameResult.rows?.[0]?.name || null;

      const outcome = await sendManualReminder({
        ventureCode: id,
        ventureName,
        item,
        sentBy: access.session?.name || null,
      });

      // 200 with the truth: "reached nobody, because nobody has an address" is a
      // real answer, not a server error.
      return NextResponse.json({ success: true, outcome });
    }

    // ── The address on file for an off-platform assignee ─────────────────────
    if (action === "set_assignee_email") {
      const displayName = String(body?.display_name || "").trim();
      const email = normalizeEmail(body?.email);
      if (!displayName) return NextResponse.json({ success: false, error: "display_name required" }, { status: 400 });
      if (!email) return NextResponse.json({ success: false, error: "errors.invalidEmail" }, { status: 400 });

      // Records an ADDRESS against the name. No person, member or account is
      // created, and no platform access is granted by it.
      await upsertAssigneeEmail({ ventureId: id, displayName, email, actorCid: access.session?.cid || null });
      return NextResponse.json({ success: true, saved: { display_name: displayName, email } });
    }

    if (action === "clear_assignee_email") {
      const displayName = String(body?.display_name || "").trim();
      if (!displayName) return NextResponse.json({ success: false, error: "display_name required" }, { status: 400 });
      await deleteAssigneeEmail({ ventureId: id, displayName });
      return NextResponse.json({ success: true });
    }

    // ── Rules ────────────────────────────────────────────────────────────────
    if (action === "add_rule") {
      const trigger = String(body?.trigger || "").trim();
      if (!REMINDER_TRIGGERS.includes(trigger)) {
        return NextResponse.json({ success: false, error: "errors.invalidTrigger" }, { status: 400 });
      }
      const daysBefore = normalizeDaysBefore(body?.days_before);
      if (daysBefore === null) {
        return NextResponse.json({ success: false, error: "errors.invalidDaysBefore" }, { status: 400 });
      }
      const scope = body?.scope === "work_item" ? "work_item" : "venture";
      let workItemKind = null;
      let workItemId = null;
      if (scope === "work_item") {
        const parts = String(body?.work_item || "").split(":");
        if (parts.length < 2 || !parts[0] || !parts[1]) {
          return NextResponse.json({ success: false, error: "work_item required" }, { status: 400 });
        }
        workItemKind = parts[0];
        workItemId = parts.slice(1).join(":");
      } else {
        // A Venture-wide rule covers ONE level. The default is the activity,
        // because a tracker row is three work items sharing one reference and a
        // rule covering all of them would email the owner three times.
        workItemKind = normalizeRuleKind(body?.work_item_kind);
      }

      const inserted = await insertReminderRule({
        ventureId: id,
        scope,
        workItemKind,
        workItemId,
        trigger,
        daysBefore,
        notifyOwner: body?.notify_owner !== false,
        notifySupporting: body?.notify_supporting === true,
        actorCid: access.session?.cid || null,
      });
      return NextResponse.json({ success: true, rule_id: inserted.rows?.[0]?.id ?? null });
    }

    if (action === "toggle_rule") {
      const ruleId = Number(body?.rule_id);
      if (!Number.isFinite(ruleId)) {
        return NextResponse.json({ success: false, error: "rule_id required" }, { status: 400 });
      }
      const updated = await setReminderRuleActive({ ventureId: id, ruleId, isActive: body?.is_active === true });
      if (!updated.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === "delete_rule") {
      const ruleId = Number(body?.rule_id);
      if (!Number.isFinite(ruleId)) {
        return NextResponse.json({ success: false, error: "rule_id required" }, { status: 400 });
      }
      const removed = await deleteReminderRule({ ventureId: id, ruleId });
      if (!removed.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
