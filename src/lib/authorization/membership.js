// Compatibility facade. The membership DECISIONS (effective-group selection,
// lifecycle transitions, effective-groups composition) moved to the service
// layer (`@/services/authorization/membership`); the schema, bootstrap, raw
// reads and shared vocabulary stay in the repository
// (`@/models/authorization/membership`). This path keeps exposing both, so
// existing importers and suites are unchanged.
export * from "@/models/authorization/membership";
export * from "@/services/authorization/membership";
