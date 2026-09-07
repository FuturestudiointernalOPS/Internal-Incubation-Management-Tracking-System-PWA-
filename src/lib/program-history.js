/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/program-history" keep resolving unchanged.
 * New code should import from "@/models/program-history".
 */
export * from "@/models/program-history";
