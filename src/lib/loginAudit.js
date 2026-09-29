import { getClientIp } from "@/lib/rate-limit";
import { recordLoginAttempt, recordFailedLogin } from "@/models/loginHistory";

/**
 * Record one sign-in attempt for the admin Security console.
 *
 * This is the single call site the two sign-in routes (`auth/login` and
 * `auth/session-login`) use, so a success and a failure are shaped identically
 * wherever they happen. It resolves the caller's IP and User-Agent, derives the
 * coarse device/browser/OS labels, and writes the history row — plus, on a
 * failure, a row in the failed-attempt table keyed by the typed identifier.
 *
 * `user` is the resolved identity (contact, team or family row) when one was
 * found, or null when the identifier matched nothing. Recording is best-effort:
 * the model swallows its own errors, so a logging failure never blocks sign-in.
 */
export async function auditLoginAttempt(
  req,
  { user = null, identifier = null, action, isSuccess = true, failureReason = null } = {},
) {
  // The whole call is guarded: recording an attempt must never change the
  // outcome of the sign-in it is describing. The model already swallows its own
  // write errors; this also covers a header/URL read on an odd request object.
  try {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || null;
    const userEmail = user?.email || user?.shared_email || identifier || null;

    await recordLoginAttempt({
      userCid: user?.cid || user?.id || null,
      userName: user?.name || null,
      userEmail,
      action,
      isSuccess,
      failureReason,
      ipAddress,
      userAgent,
    });

    if (!isSuccess) {
      await recordFailedLogin({ identifier: identifier || userEmail, ipAddress });
    }
  } catch (error) {
    console.error("Login attempt audit failed:", error.message);
  }
}

export default { auditLoginAttempt };
