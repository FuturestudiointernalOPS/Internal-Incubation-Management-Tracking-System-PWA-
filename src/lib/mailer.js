/**
 * IMPACTOS MAILER
 *
 * General-purpose email sender using Resend.
 * Falls back gracefully when Resend is not configured.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@impactos.dev";

/**
 * Send a transactional email
 * @param {Object} opts
 * @param {string} opts.to - recipient email
 * @param {string} opts.subject
 * @param {string} opts.body - HTML or plain text
 * @param {boolean} [opts.isHtml] - whether body is HTML
 * @param {string} [opts.fromName] - sender display name
 * @returns {{ success: boolean, mock?: boolean, error?: string }}
 */
export async function sendEmail({ to, subject, body, isHtml, fromName }) {
  if (!RESEND_API_KEY) {
    console.warn("Mailer: Resend not configured — skipping email to:", to);
    return { success: true, mock: true, note: "Resend not configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const from = fromName ? `${fromName} <${FROM_EMAIL}>` : FROM_EMAIL;

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      ...(isHtml ? { html: body } : { text: body }),
    });

    if (error) {
      console.error("Mailer: Resend error:", error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    return { success: true, data };
  } catch (e) {
    console.error("Mailer: Send error:", e.message);
    return { success: false, error: e.message };
  }
}
