import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Sandbox / evidence transport: write the outbound message to disk and
 * report success without contacting Gmail or Resend.
 */
export async function sendViaFile({ to, cc, subject, html, fromName, replyTo }) {
  const dir = process.env.EMAIL_SANDBOX_DIR
    || path.join(process.cwd(), "docs/investor-platform/evidence/emails");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = String(to || "unknown").replace(/[^a-zA-Z0-9._@+-]/g, "_");
  const base = `${stamp}_${safeTo}`;
  const payload = {
    to,
    cc: cc || null,
    subject,
    fromName: fromName || null,
    replyTo: replyTo || null,
    html,
    captured_at: new Date().toISOString(),
    provider: "file",
  };
  writeFileSync(path.join(dir, `${base}.json`), JSON.stringify(payload, null, 2));
  writeFileSync(path.join(dir, `${base}.html`), String(html || ""));
  return { success: true, provider: "file", data: { path: path.join(dir, `${base}.json`) } };
}
