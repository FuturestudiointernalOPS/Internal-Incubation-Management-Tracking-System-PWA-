/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/learning" keep resolving unchanged.
 * New code should import from "@/models/lms/learning".
 */
export * from "@/models/lms/learning";
