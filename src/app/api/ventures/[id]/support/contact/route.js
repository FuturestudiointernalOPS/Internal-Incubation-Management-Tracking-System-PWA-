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
 * The message goes into the platform's own MESSAGE SPACE: each chosen Lead
 * receives a direct message in their ImpactOS inbox (and the usual notification),
 * from the founder, and the founder keeps the conversation. Nothing is mailed.
 *
 * THE RECIPIENTS ARE NEVER TAKEN FROM THE REQUEST. They are resolved here from the
 * Venture's ACTIVE lead assignments; the request may only choose among them, by
 * assignment id. A lead without an account has no inbox and is reported back
 * rather than dropped.
 *
 * The gate is `ventures.view` — the weakest right that already means "this
 * person is part of this Venture". Sending is rate limited per Venture and per
 * sender, so the endpoint cannot be turned into a bulk messenger.
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
  const activeLeads = activeLeadRecipients(support);
  // The founder may pick WHO among the leads (one, or all). The request names
  // assignment ids only — never an address — and anyone who is not an active
  // lead of this Venture is simply ignored, so it still cannot act as a relay.
  const picked = Array.isArray(body?.recipients) ? body.recipients.map((value) => String(value)) : null;
  const leads = picked ? activeLeads.filter((lead) => picked.includes(String(lead.id))) : activeLeads;
  if (picked && leads.length === 0 && activeLeads.length > 0) {
    return NextResponse.json({ success: false, error: "errors.contactRecipientRequired" }, { status: 400 });
  }
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
    founderCid: session?.cid,
    founderName: session?.name || null,
    message,
    leads,
  });

  // Nobody reached: say why. Leads with no ImpactOS account have no inbox.
  if (outcome.sent === 0) {
    const noAccountOnly = outcome.failed.length > 0 && outcome.failed.every((entry) => entry.reason === "no_account");
    return NextResponse.json(
      { success: false, error: noAccountOnly ? "errors.contactNoAccount" : "errors.contactNotDelivered", failed: outcome.failed },
      { status: noAccountOnly ? 409 : 502 },
    );
  }

  return NextResponse.json({ success: true, sent: outcome.sent, failed: outcome.failed });
});
