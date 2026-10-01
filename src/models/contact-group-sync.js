/**
 * COMPATIBILITY FACADE — contact ↔ program/group sync moved to the service layer.
 *
 * This module resolved the contact, decided the fill-only writes and ran the
 * reconciliation SQL. The decisions now live in
 * `@/services/contacts/contactGroupSync`; every statement in
 * `@/models/contactGroupSyncStore`.
 *
 * Re-exported unchanged so existing importers keep working (the contacts
 * full-state route reaches it via `@/lib/contact-group-sync`). New code imports
 * from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export * from "@/services/contacts/contactGroupSync";
