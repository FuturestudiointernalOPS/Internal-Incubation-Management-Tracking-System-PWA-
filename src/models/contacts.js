/**
 * Contacts model — public entry point.
 *
 * The data access used to live in this single 860-line file. It now lives in
 * `./contacts/*`, one store per sub-domain (identity/writes, directory,
 * registry, program membership, duplicates/merge, timeline, families). This
 * file only re-exports them, so every existing importer of `@/models/contacts`
 * keeps resolving — see docs/MVC_REFACTOR.md and docs/LAYER_SPLIT.md.
 */
export * from "./contacts/contactStore";
export * from "./contacts/directory";
export * from "./contacts/registry";
export * from "./contacts/programMembership";
export * from "./contacts/duplicates";
export * from "./contacts/timeline";
export * from "./contacts/families";

/**
 * The person an email address belongs to, or nothing.
 *
 * The normalisation and the empty-input guard live in
 * `@/services/contacts/contactLookup` (the decision), with the statement in
 * `@/models/contactLookupStore`. Re-exported here so existing importers (the
 * people and invites routes) keep working — see docs/LAYER_SPLIT.md.
 */
export { findContactByEmail } from "@/services/contacts/contactLookup";
