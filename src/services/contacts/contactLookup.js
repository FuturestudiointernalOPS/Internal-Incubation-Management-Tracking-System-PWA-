import { selectContactByEmail } from "@/models/contactLookupStore";

/**
 * The person an email address belongs to, or nothing.
 *
 * Email is UNIQUE on contacts, so this answers with one row or none — never a
 * choice between two people. That is the whole reason it exists: a NAME is
 * ambiguous (two people can share one) and an email is not, so the identity
 * question "is this human already here?" is answered on the email.
 *
 * Layer (see docs/LAYER_SPLIT.md): the normalisation and the empty-input guard
 * are the decision; the statement lives in `@/models/contactLookupStore`.
 */
export async function findContactByEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return { rows: [] };
  return selectContactByEmail(clean);
}
