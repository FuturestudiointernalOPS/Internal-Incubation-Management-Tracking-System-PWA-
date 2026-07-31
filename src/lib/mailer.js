/**
 * IMPACTOS MAILER
 *
 * General-purpose email sender using Resend.
 * Falls back gracefully when Resend is not configured.
 */

export async function sendEmail({ to, subject, body, isHtml, fromName }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("Mailer: Resend not configured — skipping email to:", to);
    return { success: true, mock: true, note: "Resend not configured" };
  }

  const fromAddr = process.env.RESEND_FROM_EMAIL || "noreply@impactos.dev";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const from = fromName ? `${fromName} <${fromAddr}>` : fromAddr;

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
