/**
 * Result delivery, with the PDF
 *
 * Copy for the generic and founder-fit results, then delivery: the Gmail
 *  * transport carries the PDF as an attachment; when that fails the PDF is hosted
 *  * and the email goes out through Resend as a link, so a broken transport never
 *  * means a participant gets nothing.
 *
 * Cut out of src/lib/email.js as-is: the bodies below are byte-identical to
 * the monolith's. Nothing decides anything here that the monolith did not
 * already decide; the split only moves each concern next to its own code.
 */

import { templateVariableNames } from "@/lib/constants";
import { isPlaceholderEmail, resolveGreetingName } from "../addresses";
import { gmailCredentialsAvailable } from "../config";
import { sendViaGmail } from "../gmail";
import { sendViaResend } from "../resend";
import { FUTURE_STUDIO_FOOTER, applyTemplate } from "../templates";

// Shared inline styles for result-email paragraphs (dark card drawn by the shell).
const R_P = "color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 10px;";

const R_PL = "color:#94a3b8;font-size:14px;line-height:1.6;margin:0;";

const R_UL = "color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 10px;padding-left:20px;";

/**
 * Neutral result copy — every run EXCEPT the Founder Fit Score one. Deliberately
 * form-agnostic: it names neither the form, the run, nor what the report is.
 *
 * Both copies expose the same shape so the sender composes them identically:
 *   greetingHtml + openingHtml + accessHtml(hosted, url) + closingHtml
 */
function genericResultCopy({ isFr, greeting, frGreeting }) {
  return {
    subject: isFr ? "Résultat de votre soumission" : "Your submission result",
    greetingHtml: isFr ? `<p style="${R_P}">${frGreeting}</p>` : `<p style="${R_P}">${greeting}</p>`,
    openingHtml: "",
    // How the report is reached: attached, or a download button on the fallback
    // transport (which cannot carry the file).
    accessHtml: (hosted, url) => {
      if (!hosted) {
        return isFr
          ? `<p style="${R_PL}">Veuillez trouver ci-joint le résultat de votre soumission. Le document contient vos réponses, l'évaluation de votre soumission et votre score final. Merci pour votre participation.</p>`
          : `<p style="${R_PL}">Please find attached the result of your submission. The document contains your responses, the evaluation of your submission and your final score. Thank you for participating.</p>`;
      }
      return isFr
        ? `<p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">Le résultat de votre soumission est prêt. Le document contient vos réponses, l'évaluation de votre soumission et votre score final. Merci pour votre participation.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">TÉLÉCHARGER MON RÉSULTAT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 4px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
       <p style="color:#ff6600;font-size:11px;word-break:break-all;margin:0;">${url}</p>`
        : `<p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">The result of your submission is ready. The document contains your responses, the evaluation of your submission and your final score. Thank you for participating.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">DOWNLOAD YOUR RESULT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 4px;">If the button doesn't work, copy and paste this link into your browser:</p>
       <p style="color:#ff6600;font-size:11px;word-break:break-all;margin:0;">${url}</p>`;
    },
    closingHtml: "",
  };
}

/**
 * Founder Fit Score result copy — used only by that run. Presents the report,
 * states the score out of 100, and closes on the recommendation.
 *
 * `scoreText` and `project` are optional: without a score the score sentence is
 * dropped, and without a project name the recommendation refers to "your
 * project" — so a form that never asked for a venture still reads correctly.
 */
function founderFitResultCopy({ isFr, greeting, frGreeting, scoreText, project }) {
  return {
    subject: isFr ? "Votre Founder Fit Score est disponible" : "Your Founder Fit Score is available",
    greetingHtml: isFr ? `<p style="${R_P}">${frGreeting}</p>` : `<p style="${R_P}">${greeting}</p>`,
    openingHtml: isFr
      ? `<p style="${R_P}">Merci d'avoir pris le temps de compléter le Founder Fit Score de Future Studio.</p>
       <p style="${R_P}">À partir de vos réponses, nous avons préparé un rapport personnalisé qui présente :</p>
       <ul style="${R_UL}">
         <li>votre score global ;</li>
         <li>votre résultat sur chacun des sept critères ;</li>
         <li>vos principaux points forts ;</li>
         <li>vos axes prioritaires de progression ;</li>
         <li>des recommandations concrètes pour faire évoluer votre projet.</li>
       </ul>
       ${scoreText ? `<p style="${R_P}">Votre Founder Fit Score est de <strong style="color:#f8fafc;">${scoreText} / 100</strong>.</p>` : ""}
       <p style="${R_P}">Ce résultat ne constitue ni un jugement définitif ni une étiquette. Il représente une photographie de votre profil actuel et vise à vous aider à mieux comprendre vos forces, les points à consolider et les prochaines décisions à prendre.</p>`
      : `<p style="${R_P}">Thank you for taking the time to complete Future Studio's Founder Fit Score.</p>
       <p style="${R_P}">Based on your answers, we have prepared a personalised report that presents:</p>
       <ul style="${R_UL}">
         <li>your overall score;</li>
         <li>your result on each of the seven criteria;</li>
         <li>your main strengths;</li>
         <li>your priority areas for progress;</li>
         <li>concrete recommendations to move your project forward.</li>
       </ul>
       ${scoreText ? `<p style="${R_P}">Your Founder Fit Score is <strong style="color:#f8fafc;">${scoreText} / 100</strong>.</p>` : ""}
       <p style="${R_P}">This result is neither a definitive judgment nor a label. It is a snapshot of your profile today, meant to help you better understand your strengths, what to consolidate and the next decisions to take.</p>`,
    accessHtml: (hosted, url) => {
      if (hosted) {
        return isFr
          ? `<p style="${R_P}">Vous pouvez consulter votre rapport complet en téléchargeant le document ci-dessous.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">TÉLÉCHARGER MON RAPPORT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 10px;">Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur : <span style="color:#ff6600;word-break:break-all;">${url}</span></p>`
          : `<p style="${R_P}">You can read your full report by downloading the document below.</p>
       <table cellpadding="0" cellspacing="0" style="margin: 0 0 20px;"><tr><td align="center" style="background: #ff6600; border-radius: 12px; padding: 14px 32px;"><a href="${url}" style="color: #000; text-decoration: none; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">DOWNLOAD MY REPORT (PDF)</a></td></tr></table>
       <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0 0 10px;">If the button doesn't work, copy and paste this link into your browser: <span style="color:#ff6600;word-break:break-all;">${url}</span></p>`;
      }
      return isFr
        ? `<p style="${R_P}">Vous pouvez consulter votre rapport complet à travers le fichier joint.</p>`
        : `<p style="${R_P}">You can read your full report in the attached file.</p>`;
    },
    closingHtml: isFr
      ? `<p style="${R_P}">Nous vous recommandons de prendre le temps de lire les actions proposées, notamment celles liées à la validation du marché, à la traction commerciale et à la différenciation de ${project || "votre projet"}.</p>
       <p style="${R_P}">Nous restons disponibles pour échanger avec vous sur les résultats et identifier l'accompagnement Future Studio le plus adapté à votre niveau d'avancement.</p>
       <p style="${R_PL}">Bien cordialement,<br>L'équipe Future Studio</p>`
      : `<p style="${R_P}">We recommend taking the time to read the proposed actions, especially those related to market validation, commercial traction and the differentiation of ${project || "your project"}.</p>
       <p style="${R_P}">We remain available to talk through the results with you and to identify the Future Studio support best suited to your stage of progress.</p>
       <p style="${R_PL}">Kind regards,<br>The Future Studio Team</p>`,
  };
}

/**
 * Send a participant-facing submission result email with a PDF document
 * (their responses, the evaluation and their final score).
 *
 * The copy comes from one of two sources, picked by `template`: the Founder Fit
 * Score message (`"founder_fit"`) or the neutral, form-agnostic one. Whoever the
 * recipient is, the message never mentions how the evaluation was produced.
 *
 * `score` and `projectName` are optional and only the Founder Fit copy uses
 * them: without a score its score sentence is dropped, and without a project
 * name its recommendation refers to "your project".
 *
 * A text DESIGNED in the UI (run → form — see getDesignedTemplate) takes over
 * the message. The built-in copy then only supplies what the author left blank,
 * and the "how to reach the document" lines stay application-owned: a designed
 * text can never point the recipient at a document that is not there, nor
 * promise an attachment that the transport could not carry.
 *
 * Delivery:
 *  - Gmail transport attaches the PDF natively when Google Workspace
 *    credentials are configured.
 *  - Otherwise the PDF is hosted in Supabase storage and delivered as a
 *    download button through Resend (never silently dropped).
 */
export async function sendResultEmail({ to, applicantName, pdfBuffer, lang = "en", runId, submissionId, score, projectName, template, designed }) {
  const isFr = (lang || "en").toLowerCase().startsWith("fr");
  const greetingName = resolveGreetingName(applicantName);
  const greeting = greetingName ? `Hello ${greetingName},` : "Hello,";
  const frGreeting = greetingName ? `Bonjour ${greetingName},` : "Bonjour,";
  const filename = "submission-result.pdf";
  const pdf = pdfBuffer ? Buffer.from(pdfBuffer) : null;

  // Optional inputs, both resolved by the caller from the submission: a form
  // that never asked for a venture produces an empty project, and an evaluation
  // without a score produces no score sentence at all.
  const project = typeof projectName === "string" ? projectName.replace(/\s+/g, " ").trim() : "";
  const scoreNum = Number(score);
  const scoreText = Number.isFinite(scoreNum) && String(score ?? "").trim() !== "" ? String(Math.round(scoreNum)) : "";

  // The Founder Fit Score run gets its own report-specific message; every other
  // run keeps the neutral, form-agnostic copy.
  const copy = template === "founder_fit"
    ? founderFitResultCopy({ isFr, greeting, frGreeting, scoreText, project })
    : genericResultCopy({ isFr, greeting, frGreeting });

  // What a designed text may use. Every name here is one THIS sender fills in,
  // so the list the editors show and the values substituted cannot drift.
  const tv = {
    // A missing name must read as a greeting, not as an English filler word in a
    // French message: no known name means an EMPTY name, which the substitution
    // turns back into "Bonjour," — never "Bonjour there,". English keeps its
    // idiomatic "Hello there,".
    name: greetingName || (isFr ? "" : "there"),
    // The result message speaks in the platform's own voice (its built-in copies
    // say "Future Studio" and close with the Future Studio team).
    organization: "Future Studio",
    score: scoreText,
    // A sentence that hangs on the project name must never be left incomplete:
    // with no name found, it says "votre projet" / "your project" instead of
    // printing a gap ("la différenciation de .").
    project_name: project || (isFr ? "votre projet" : "your project"),
  };

  const designedSubject = typeof designed?.subject === "string" ? designed.subject.trim() : "";
  const designedBody = typeof designed?.body === "string" ? designed.body.trim() : "";
  const subject = designedSubject ? applyTemplate(designedSubject, tv) : copy.subject;

  if (isPlaceholderEmail(to)) {
    console.warn("[Email] REFUSING to send to placeholder address:", to);
    return { success: false, provider: "blocked", error: "Refused — placeholder address is not a real recipient" };
  }
  if (!pdf) {
    return { success: false, provider: "email", error: "Result PDF is empty — nothing to send" };
  }

  const shell = (bodyHtml) => `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #020617;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table width="480" cellpadding="0" cellspacing="0" style="background: #0f172a; border-radius: 16px; border: 1px solid #334155;">
            <tr><td style="padding: 40px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 800;">${subject}</h1>
              ${bodyHtml}
              ${FUTURE_STUDIO_FOOTER}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

  // One body for both transports — the copy is identical, only the way the
  // report is reached differs (attached, or a download button on the fallback).
  // A designed text replaces the editorial part; the lines that tell the
  // recipient how to REACH the document stay the application's. A designed text
  // places them where it wants with {{document_access}}; when it does not use
  // that variable at all they are appended instead. Either way the recipient
  // always gets a way to the document, and a designed text can never promise an
  // attachment that the transport could not carry.
  const designedAccessSlot = templateVariableNames(designedBody).includes("document_access");
  const compose = (hosted, url = "") =>
    shell(
      (designedBody
        ? applyTemplate(designedBody, { ...tv, document_access: copy.accessHtml(hosted, url) })
        : copy.greetingHtml + copy.openingHtml) +
        (designedBody && designedAccessSlot ? "" : copy.accessHtml(hosted, url)) +
        (designedBody ? "" : copy.closingHtml),
    );

  // Preferred path: native PDF attachment through the Gmail API transport.
  if (gmailCredentialsAvailable()) {
    const res = await sendViaGmail({
      to,
      subject,
      html: compose(false),
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    });
    if (res.success) return res;
    // Gmail failed → fall through to the hosted-link delivery below instead of
    // failing: the participant still receives their result.
  }

  // Fallback path: host the PDF in Supabase storage (public bucket, same as
  // the platform's uploads) and email a download link through Resend.
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { success: false, provider: "storage", error: "No attachment-capable email transport configured: set GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY" };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const rand = Math.random().toString(36).slice(2, 10);
    const folder = runId ? `run-${runId}` : "general";
    const objectPath = `submission-results/${folder}/${submissionId ? `submission-${submissionId}-` : ""}${Date.now()}-${rand}.pdf`;
    const upload = () =>
      supabase.storage.from("submissions").upload(objectPath, pdf, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true,
      });
    let res = await upload();
    if (res.error && /bucket.*not found|does not exist/i.test(res.error.message || "")) {
      await supabase.storage.createBucket("submissions", { public: true });
      res = await upload();
    }
    if (res.error) throw res.error;
    const url = supabase.storage.from("submissions").getPublicUrl(objectPath).data.publicUrl;
    const mailRes = await sendViaResend({ to, subject, html: compose(true, url) });
    if (!mailRes.success) {
      return { ...mailRes, error: mailRes.error || mailRes.note || "Email send failed" };
    }
    return mailRes;
  } catch (error) {
    console.error("[Email] Result delivery (hosted PDF) error:", error?.message || error);
    return { success: false, provider: "storage", error: `Could not store the result PDF for delivery — ${error?.message || "storage error"}` };
  }
}
