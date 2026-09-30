/**
 * COMPATIBILITY FACADE — venture document types split into service + store.
 *
 * The decisions (seed only when empty, fall back to the built-in set, unique
 * code, delete guards, who may manage) live in
 * `@/services/ventures/ventureDocumentTypes`; every statement in
 * `./ventureDocumentTypesStore`.
 *
 * Re-exported together so existing importers keep working (the routes, and the
 * two suites that mock or inject a database on this path). New code imports the
 * decisions from the service and the statements from the store. Deleted once
 * `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "./ventureDocumentTypesStore";
export * from "@/services/ventures/ventureDocumentTypes";
