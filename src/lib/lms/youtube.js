/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/youtube" keep resolving unchanged.
 * New code should import from "@/models/lms/youtube".
 */
export * from "@/models/lms/youtube";
