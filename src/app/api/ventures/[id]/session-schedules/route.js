import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { checkSessionManagement } from "@/services/ventures/sessionAuthority";
import {
  createSchedule,
  createScheduleVersion,
  endSchedule,
  listSchedules,
  previewSchedule,
  setScheduleStatus,
} from "@/services/ventures/recurringSchedules";

/**
 * GET/POST /api/ventures/[id]/session-schedules — P1, PLANNING ONLY.
 *
 * There is deliberately no action here that creates a session, sends a notice or
 * touches a calendar. `preview` is the whole point of the phase: a manager sees
 * what a pattern would produce before anything is committed.
 *
 * Access: staff only. A Venture keeps booking individual sessions; it does not
 * define the studio's recurring rhythm.
 */

const STAFF_ONLY = { success: false, error: "errors.insufficientPermissions" };

async function staffGate({ id, access, req, requireSchedule }) {
  const actor = access.session || req.session;
  const isStaff = await isStaffActorForVenture(id, actor).catch(() => false);
  if (!isStaff) return { error: NextResponse.json(STAFF_ONLY, { status: 403 }) };

  if (requireSchedule) {
    const refusal = await checkSessionManagement({ ventureParam: id, access, actor, staffActor: true });
    if (refusal) return { error: NextResponse.json(refusal, { status: 403 }) };
  }

  return { actor };
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;

  const gate = await staffGate({ id, access, req, requireSchedule: false });
  if (gate.error) return gate.error;

  const result = await listSchedules({ ventureRef: id });
  return NextResponse.json({ success: true, ...result });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;

  const gate = await staffGate({ id, access, req, requireSchedule: true });
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "preview");

  // PREVIEW WRITES NOTHING. It is the button the manager presses before saving.
  if (action === "preview") {
    const result = previewSchedule(body.schedule || body, {
      from: body.from || null,
      to: body.to || null,
      limit: body.limit,
    });
    if (result.errors?.length) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ success: true, window: result.window, occurrences: result.occurrences });
  }

  if (action === "create") {
    const result = await createSchedule({ ventureRef: id, input: body.schedule || body, actorCid: gate.actor?.cid });
    if (result.errors?.length) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ success: true, schedule: result.schedule });
  }

  if (action === "pause" || action === "resume") {
    const result = await setScheduleStatus({ ventureRef: id, scheduleId: body.schedule_id, action });
    if (result.errors?.length) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ success: true, schedule: result.schedule });
  }

  if (action === "end") {
    const result = await endSchedule({ ventureRef: id, scheduleId: body.schedule_id, validUntil: body.valid_until || null });
    if (result.errors?.length) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ success: true, schedule: result.schedule });
  }

  // "Modify from here on": a NEW version; the old one is ended the day before.
  if (action === "new_version") {
    const result = await createScheduleVersion({
      ventureRef: id,
      scheduleId: body.schedule_id,
      input: body.schedule || body,
      actorCid: gate.actor?.cid,
    });
    if (result.errors?.length) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ success: true, schedule: result.schedule });
  }

  return NextResponse.json({ success: false, error: "venture.schedule.error.action" }, { status: 400 });
});
