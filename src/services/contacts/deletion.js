/**
 * CONTACT DELETION — the soft-delete use-case.
 *
 * Deleting a contact never removes the row: it records WHO deleted it and WHEN,
 * flags it, and frees the e-mail by replacing it with a unique placeholder that
 * keeps the original address for audit (so the address can be reused by a new
 * contact later without tripping the unique constraint). The actor is always the
 * session, never the request body.
 *
 * Writes go through `@/models/contacts`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  softDeleteContact,
} from "@/models/contacts/contactStore";

/** Soft-delete a contact as `actor`; false when no row matched. */
export async function softDeleteRegistryContact(actor, cid) {
  const result = await softDeleteContact(actor, cid);
  return result.rowsAffected > 0;
}
