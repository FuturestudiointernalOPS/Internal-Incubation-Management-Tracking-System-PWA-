import { v4 as uuidv4 } from "uuid";
import { createPasswordSetupToken, markContactInvited } from "@/models/contacts";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";

/**
 * Generates an invite token and sends activation email. Non-blocking on failure.
 */
export async function fireInvite(cid, name, email, role, _groupId) {
  try {
    await ensureTokenHashColumns();
    const token = uuidv4();
    const tokenHash = hashToken(token);

    await createPasswordSetupToken(token, tokenHash, cid);

    await markContactInvited(cid).catch(() => {}); // Column may not exist yet — non-critical
    // Send email synchronously so Vercel doesn't kill the worker
    const { sendInviteEmail } = await import("@/lib/email");
    await sendInviteEmail({ to: email, name, role, token, contact_cid: cid });
  } catch (error) {
    console.error("Invite fire failed:", error.message || error);
  }
}
