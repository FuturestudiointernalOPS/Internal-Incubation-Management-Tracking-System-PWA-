import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getVentureDisplayNameByCode } from "@/models/ventureWorkspace";
import {
  MAX_MESSAGE_LENGTH,
  activeLeadRecipients,
  readVentureSupport,
  sendFounderMessageToLeads,
} from "@/services/ventures/support";

/**
 * POST /api/ventures/[id]/support/contact — a founder writes to their Leads.
 *
 * WHY THIS EXISTS. A `mailto:` link hands the message to the founder's own mail
 * client: ImpactOS never learns it happened, nothing is logged, and a founder
 * without a configured mail client gets no feedback at all. This route sends the
 * message through the platform's own transport instead, so the Venture Lead is
 * reached even when the founder's desktop is not set up for mail — and the
 * founder is told whether it actually left.
 *
 * THE RECIPIENTS ARE NEVER TAKEN FROM THE REQUEST. They are resolved here from
 * the Venture's ACTIVE lead assignments, so nobody can use this endpoint as an
 * open relay. A lead without an address on file is reported back as unreachable
 * rather than dropped.
 *
 * The gate is `ventures.view` — the weakest right that already means "this
 * person is part of this Venture". Sending is rate limited per Venture and per
 * sender, so the endpoint cannot be turned into a bulk mailer.
 */
export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({
    ventureId: id,
    module: "ventures",
    capability: "view",
  });
  if (access.error) return access.error;

  const session = req.session || access.session;

  // Per sender, per Venture. Five messages per quarter hour is far more than a
  // genuine conversation needs and far less than an abuse attempt requires.
  const limited = enforceRateLimit(req, `venture-contact:${id}:${session?.cid || "anon"}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim();
  if (!message) {
    return NextResponse.json({ success: false, error: "errors.contactMessageRequired" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { success: false, error: "errors.contactMessageTooLong", max: MAX_MESSAGE_LENGTH },
      { status: 400 },
    );
  }

  const support = await readVentureSupport(id);
  const leads = activeLeadRecipients(support);
  if (leads.length === 0) {
    // Nobody to write to: say so instead of silently succeeding.
    return NextResponse.json(
      { success: false, error: "errors.noActiveVentureLead" },
      { status: 409 },
    );
  }

  const ventureName = (await getVentureDisplayNameByCode(id).catch(() => ({ rows: [] })))
    ?.rows?.[0]?.venture_name || null;

  const outcome = await sendFounderMessageToLeads({
    ventureName,
    founderName: session?.name || null,
    founderEmail: session?.email || null,
    message,
    leads,
  });

  // "Sent to nobody" is a failure, not a success with an empty list.
  if (outcome.sent === 0) {
    return NextResponse.json(
      { success: false, error: "errors.contactNotDelivered", failed: outcome.failed },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    sent: outcome.sent,
    failed: outcome.failed,
    reply_to_used: outcome.reply_to_used,
  });
});
