// Compatibility facade. The eligibility DECISION moved to the service layer
// (`@/services/authorization/eligibility`); the schema, seeds and vocabulary
// stay in the repository (`@/models/authorization/eligibility`). This path
// keeps exposing both, so existing importers and suites are unchanged.
export * from "@/models/authorization/eligibility";
export * from "@/services/authorization/eligibility";
