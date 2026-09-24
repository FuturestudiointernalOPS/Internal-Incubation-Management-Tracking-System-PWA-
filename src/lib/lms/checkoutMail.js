import { sendStandaloneEmail } from "@/lib/email";
import { resolveAppUrl } from "@/lib/appUrl";
import { getCourse } from "@/models/lms/courses";

/**
 * CHECKOUT EMAIL
 *
 * One transactional email, three shapes — and NEVER a credential:
 *
 *   paid + access ready      -> "choose your password" (one-time link) or
 *                               "go to my course" when a password already exists
 *   paid + access in progress-> "your payment is confirmed, we are preparing your
 *                               access" (this MUST go out even when the access
 *                               step failed, otherwise a payer is left with no
 *                               receipt and a reason to pay again)
 *   not paid yet             -> "finish your registration" (one-time link)
 *
 * The link is the ONLY thing that travels; it is a one-time code the person
 * redeems by choosing their own password. No login, no password, ever, in an
 * email.
 *
 * Returns the transport's REAL outcome — never a simulated success — so the
 * registration's `email_status` reflects reality.
 */

function copyFor({ language, courseTitle, amount, currency, kind }) {
  const isFr = String(language || "en").toLowerCase().startsWith("fr");
  const amountLabel = `${Number(amount || 0).toLocaleString()} ${currency || ""}`.trim();

  if (isFr) {
    const base = {
      amountLabel: "Montant",
      referenceLabel: "Référence",
      amountLine: amountLabel,
    };
    if (kind === "access") {
      return {
        ...base,
        subject: `Paiement confirmé — ${courseTitle}`,
        heading: "Votre paiement est confirmé",
        body: `Votre inscription à « ${courseTitle} » est confirmée et votre accès est prêt.`,
        cta: "Choisir mon mot de passe",
        footer:
          "Pour entrer, vous choisissez vous-même votre mot de passe. Aucun mot de passe ne circule par e-mail.",
      };
    }
    if (kind === "access_granted") {
      return {
        ...base,
        subject: `Votre accès est prêt — ${courseTitle}`,
        heading: "Votre accès est prêt",
        body: `Votre inscription à « ${courseTitle} » est confirmée. Connectez-vous pour retrouver votre cours dans « My Learning ».`,
        cta: "Accéder à mon espace",
        footer: "Conservez cet e-mail : il vous permet de retrouver votre accès à tout moment.",
      };
    }
    if (kind === "access_pending") {
      return {
        ...base,
        subject: `Paiement confirmé — ${courseTitle}`,
        heading: "Votre paiement est confirmé",
        body: `Nous avons bien reçu votre paiement pour « ${courseTitle} ». Nous préparons votre accès et vous recevrez un second e-mail dès qu'il est prêt.`,
        cta: null,
        footer:
          "Vous n'avez rien d'autre à faire, et surtout pas de payer à nouveau : votre paiement est enregistré.",
      };
    }
    return {
      ...base,
      subject: `Finalisez votre inscription — ${courseTitle}`,
      heading: "Finalisez votre inscription",
      body: `Votre inscription à « ${courseTitle} » est enregistrée mais le paiement n'a pas encore été confirmé.`,
      cta: "Reprendre mon paiement",
      footer: "Ce lien vous permet de reprendre exactement là où vous vous êtes arrêté.",
    };
  }

  const base = {
    amountLabel: "Amount",
    referenceLabel: "Reference",
    amountLine: amountLabel,
  };
  if (kind === "access") {
    return {
      ...base,
      subject: `Payment confirmed — ${courseTitle}`,
      heading: "Your payment is confirmed",
      body: `Your registration for "${courseTitle}" is confirmed and your access is ready.`,
      cta: "Choose my password",
      footer:
        "You choose your own password to get in. No password ever travels by email.",
    };
  }
  if (kind === "access_granted") {
    return {
      ...base,
      subject: `Your access is ready — ${courseTitle}`,
      heading: "Your access is ready",
      body: `Your registration for "${courseTitle}" is confirmed. Sign in to find your course in "My Learning".`,
      cta: "Go to my account",
      footer: "Keep this email: it lets you get back to your access at any time.",
    };
  }
  if (kind === "access_pending") {
    return {
      ...base,
      subject: `Payment confirmed — ${courseTitle}`,
      heading: "Your payment is confirmed",
      body: `We have received your payment for "${courseTitle}". We are preparing your access and you will get a second email as soon as it is ready.`,
      cta: null,
      footer:
        "There is nothing else to do — and in particular, do NOT pay again: your payment is recorded.",
    };
  }
  return {
    ...base,
    subject: `Finish your registration — ${courseTitle}`,
    heading: "Finish your registration",
    body: `Your registration for "${courseTitle}" is recorded, but the payment has not been confirmed yet.`,
    cta: "Resume my payment",
    footer: "This link takes you back exactly where you stopped.",
  };
}

function renderHtml({ copy, amountLabel, reference, url }) {
  const table = `
    <table style="width:100%;border-collapse:collapse;margin:0 0 ${copy.cta ? "24px" : "0"};font-size:13px;">
      <tr>
        <td style="padding:6px 0;color:#a1a1aa;">${copy.amountLabel}</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;">${amountLabel}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#a1a1aa;">${copy.referenceLabel}</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;">${reference}</td>
      </tr>
    </table>`;

  const button = copy.cta
    ? `<a href="${url}" style="display:inline-block;background:#f97316;color:#0b0b0d;font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:12px;padding:14px 24px;border-radius:10px;text-decoration:none;">${copy.cta}</a>`
    : "";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0b0d;padding:32px 16px;">
      <div style="max-width:520px;margin:0 auto;background:#141417;border:1px solid #26262c;border-radius:16px;padding:32px;color:#f4f4f5;">
        <h1 style="margin:0 0 20px;font-size:18px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#f97316;">${copy.heading}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">${copy.body}</p>
        ${table}
        ${button}
        <p style="margin:24px 0 0;font-size:11px;line-height:1.6;color:#71717a;">${copy.footer}</p>
      </div>
    </div>`;
}

async function resolveCourseTitle(registration) {
  if (!registration?.course_id) return "";
  const course = await getCourse(registration.course_id).catch(() => null);
  return course?.title || "";
}

/**
 * Send the one email that fits the current state of a registration.
 *
 * `accessToken`  the freshly minted one-time code (in-window / just fulfilled)
 * `resumeToken`  the "finish your payment" one-time code
 *
 * Exactly one of them is used, depending on the shape.
 */
export async function sendCheckoutEmail({
  registration,
  courseTitle = null,
  accessToken = null,
  resumeToken = null,
}) {
  const isPaid = registration.status === "paid";
  const kind = !isPaid
    ? "resume"
    : accessToken
      ? "access"
      : registration.access_status === "granted"
        ? "access_granted"
        : "access_pending";

  const title = courseTitle || (await resolveCourseTitle(registration));
  const base = resolveAppUrl();
  const url = accessToken
    ? `${base}/setup-password/${accessToken}`
    : isPaid
      ? `${base}/login?next=${encodeURIComponent(`/participant/learning/${registration.course_id}`)}`
      : `${base}/checkout/resume/${resumeToken}`;

  const copy = copyFor({
    language: registration.language,
    courseTitle: title,
    amount: registration.amount,
    currency: registration.currency,
    kind,
  });

  const amountLabel = `${Number(registration.amount || 0).toLocaleString()} ${registration.currency || ""}`.trim();

  return sendStandaloneEmail({
    to: registration.email,
    subject: copy.subject,
    html: renderHtml({ copy, amountLabel, reference: registration.reference, url }),
    contact_cid: registration.user_cid || null,
    email_type: "lms_purchase",
  });
}

/**
 * Convenience for the payment path: send what the state calls for, without
 * persisting anything (the caller records `email_status`).
 */
export async function deliverCheckoutEmail({ registration, courseTitle = null, accessToken = null, resumeToken = null }) {
  try {
    const result = await sendCheckoutEmail({ registration, courseTitle, accessToken, resumeToken });
    return {
      sent: Boolean(result?.success),
      provider: result?.provider || null,
      error: result?.success ? null : result?.error || "lms.errors.emailFailed",
    };
  } catch (error) {
    return { sent: false, provider: null, error: String(error?.message || error) };
  }
}
