/**
 * Investor service — the investor password setup.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the required
 * fields, the minimum length, the setup-token lookup and its expiry, then the
 * hash and the write. Every statement lives in `@/models/investorRelations`.
 * No SQL, no HTTP: a refusal is a value ({ ok: false, status, error }) the HTTP
 * boundary turns into a response.
 */

import { hashPassword } from "@/server/auth/password";
import {
  clearSetupTokenAndSetPassword,
  findContactBySetupToken,
} from "@/models/investorRelations";

/** Set the password behind a valid, unexpired setup link. */
export async function setupInvestorPassword({ token, password }) {
  if (!token || !password) {
    return { ok: false, status: 400, error: "Token and password are required." };
  }
  if (password.length < 6) {
    return { ok: false, status: 400, error: "Password must be at least 6 characters." };
  }

  const result = await findContactBySetupToken(token);
  if (result.rows.length === 0) {
    return { ok: false, status: 404, error: "Invalid or expired setup link." };
  }

  const contact = result.rows[0];
  if (contact.setup_token_expires && new Date(contact.setup_token_expires) < new Date()) {
    return {
      ok: false,
      status: 410,
      error: "Setup link has expired. Please contact Future Studio.",
    };
  }

  const hashedPassword = await hashPassword(password);
  await clearSetupTokenAndSetPassword(hashedPassword, contact.cid);

  return { ok: true };
}
