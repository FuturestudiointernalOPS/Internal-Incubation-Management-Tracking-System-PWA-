import { getRelationshipWorkspaceDetail } from "@/models/investorRelations/relationships";
import {
  countUnreadWorkspaceMessages,
  claimWorkspaceMessageReminder,
  insertWorkspaceMessage,
  listUnreadWorkspaceMessageReminders,
  listWorkspaceMessages,
  markWorkspaceMessagesRead,
  markWorkspaceMessageReminderSent,
  releaseWorkspaceMessageReminder,
} from "@/models/investor/workspaceMessages";
import { listActiveFounderVentures } from "@/models/authorization/contextGrantsStore";
import {
  listWorkspacesByInvestor,
  listWorkspacesByVentureIds,
} from "@/models/investor/meetingSlots";
import { emitInvestorEvent, resolveInvestorContext } from "@/services/investor/activity";
import { sendStandaloneEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/appUrl";
import { logger } from "@/lib/logger";

const isValidWorkspaceId = (id) =>
  typeof id === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

async function getAuthorizedWorkspace({ workspaceId, session }) {
  if (!isValidWorkspaceId(workspaceId) || !session?.cid) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }

  const result = await getRelationshipWorkspaceDetail(String(workspaceId));
  const workspace = result.rows?.[0];
  if (!workspace || workspace.status !== "active" || !workspace.investor_cid) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }

  const investor = await resolveInvestorContext(session);
  if (investor.investorId && investor.approvalStatus === "approved"
    && String(investor.investorId) === String(workspace.investor_id)) {
    return { ok: true, workspace, actorType: "investor", investorId: investor.investorId };
  }

  const founderVentures = await listActiveFounderVentures(session.cid);
  if (founderVentures.some((id) => String(id) === String(workspace.venture_id))) {
    return { ok: true, workspace, actorType: "founder", investorId: workspace.investor_id };
  }

  return { ok: false, status: 403, error: "errors.insufficientPermissions" };
}

function messageDto(message, viewerId) {
  return {
    id: message.id,
    body: message.body,
    sender_name: message.sender_name,
    created_at: message.created_at,
    is_read: Boolean(message.is_read),
    from_me: String(message.sender_id) === String(viewerId),
  };
}

export async function readWorkspaceConversation({ workspaceId, session }) {
  const access = await getAuthorizedWorkspace({ workspaceId, session });
  if (!access.ok) return access;

  const read = await markWorkspaceMessagesRead({
    workspaceId,
    readerId: session.cid,
  });
  for (const message of read.rows || []) {
    await emitInvestorEvent({
      session,
      investorId: access.investorId,
      eventType: "message_read",
      ventureId: String(access.workspace.venture_id),
      relatedId: message.id,
      actorType: access.actorType,
      metadata: { workspace_id: String(workspaceId) },
    });
  }

  const messages = await listWorkspaceMessages(workspaceId);
  return {
    ok: true,
    messages: (messages.rows || []).map((message) => messageDto(message, session.cid)),
  };
}

export async function sendWorkspaceMessage({ workspaceId, body, session }) {
  if (typeof body !== "string" || !body.trim() || body.length > 4000) {
    return { ok: false, status: 400, error: "errors.invalidRequest" };
  }

  const access = await getAuthorizedWorkspace({ workspaceId, session });
  if (!access.ok) return access;

  const result = await insertWorkspaceMessage({
    workspaceId,
    senderId: session.cid,
    body: body.trim(),
  });
  const message = result.rows?.[0];
  if (!message) return { ok: false, status: 500, error: "errors.somethingWrong" };

  await emitInvestorEvent({
    session,
    investorId: access.investorId,
    eventType: "message_sent",
    ventureId: String(access.workspace.venture_id),
    relatedId: message.id,
    actorType: access.actorType,
    metadata: { workspace_id: String(workspaceId) },
  });

  return { ok: true, message: messageDto(message, session.cid) };
}

export async function countUnreadWorkspaceMessagesForCaller({ session }) {
  if (!session?.cid) return { ok: false, status: 401, error: "errors.unauthorized" };
  const investor = await resolveInvestorContext(session);
  const workspaceRows = [];
  if (investor?.investorId && investor.approvalStatus === "approved") {
    workspaceRows.push(...((await listWorkspacesByInvestor(investor.investorId)).rows || []));
  }
  const founderVentures = await listActiveFounderVentures(session.cid);
  if (founderVentures.length > 0) {
    workspaceRows.push(...((await listWorkspacesByVentureIds(founderVentures)).rows || []));
  }
  const workspaceIds = [...new Set(
    workspaceRows.filter((workspace) => workspace.status === "active").map((workspace) => String(workspace.id)),
  )];
  const result = await countUnreadWorkspaceMessages({
    workspaceIds,
    readerId: session.cid,
  });
  return { ok: true, unreadCount: Number(result.rows?.[0]?.unread_count || 0) };
}

export async function sendDueWorkspaceMessageReminders({ session = null } = {}) {
  let sent = 0;
  let failed = 0;
  const due = await listUnreadWorkspaceMessageReminders();

  for (const reminder of due.rows || []) {
    const claim = await claimWorkspaceMessageReminder({
      workspaceId: reminder.workspace_id,
      recipientCid: reminder.recipient_cid,
    });
    const claimId = claim.rows?.[0]?.id;
    if (!claimId) continue;

    const language = reminder.recipient_language === "fr" ? "fr" : "en";
    const route = reminder.recipient_type === "founder" ? "founder" : "investor";
    const conversationUrl = `${resolveAppUrl()}/${route}/messages/${encodeURIComponent(reminder.workspace_id)}`;
    const copy = language === "fr"
      ? {
          subject: `Nouveau message de ${reminder.sender_name}`,
          body: `Vous avez un nouveau message de ${reminder.sender_name}. Ouvrez votre conversation sécurisée : ${conversationUrl}`,
        }
      : {
          subject: `New message from ${reminder.sender_name}`,
          body: `You have a new message from ${reminder.sender_name}. Open your secure conversation: ${conversationUrl}`,
        };

    try {
      const delivery = await sendStandaloneEmail({
        to: reminder.recipient_email,
        contact_cid: reminder.recipient_cid,
        email_type: "investor_workspace_message_reminder",
        subject: copy.subject,
        body: copy.body,
      });
      if (!delivery?.success) throw new Error("Email transport did not confirm delivery");
      await markWorkspaceMessageReminderSent(claimId);
      await emitInvestorEvent({
        session,
        investorId: reminder.investor_profile_id,
        eventType: "message_email_sent",
        ventureId: String(reminder.venture_id),
        relatedId: reminder.message_id,
        actorType: "system",
        metadata: { workspace_id: String(reminder.workspace_id), window: "6h" },
      });
      sent += 1;
    } catch (error) {
      await releaseWorkspaceMessageReminder(claimId);
      logger.error("investor_workspace_message_reminder_failed", {
        workspaceId: String(reminder.workspace_id),
        messageId: reminder.message_id,
        error: error.message,
      });
      failed += 1;
    }
  }

  return { ok: failed === 0, sent, failed };
}
