/**
 * The Resend transport
 *
 * One HTTPS call to the API. No attachment support: callers that need a file
 *  * host it and send a link (see senders/results.js).
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { FROM_EMAIL, RESEND_API_KEY } from "./config";

/**
 * Internal: sends email via Resend
 */
export async function sendViaResend({ to, subject, html, fromName }) {
  if (!RESEND_API_KEY) {
    console.warn("Resend not configured — skipping email to:", to, "subject:", subject);
    return { success: false, provider: "resend", note: "Resend API key not configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: fromName ? `${fromName} <${FROM_EMAIL}>` : FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, provider: "resend", error };
    }

    return { success: true, provider: "resend", data };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, provider: "resend", error: error.message };
  }
}
