/**
 * LEGACY IDENTITY NORMALIZATION (SERVICE layer).
 *
 * The boot-time hook for the one-time data migration: it delegates to the model
 * (which owns the SQL and the transaction) and logs the outcome. Kept separate
 * so the bootstrap imports a service, and the model stays HTTP-free.
 */

import { migrateLegacyIdentities } from "@/models/authorization/legacyIdentityStore";

export async function normalizeLegacyIdentities() {
  const result = await migrateLegacyIdentities();

  if (result.updated > 0 || result.cards > 0) {
    console.log("[authz] legacy identities normalized", {
      updated: result.updated,
      cards: result.cards,
      withoutRelationship: result.withoutRelationship,
    });
  }

  return result;
}
