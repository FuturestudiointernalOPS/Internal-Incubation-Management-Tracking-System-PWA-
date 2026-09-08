/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/constants" keep resolving unchanged.
 * New code should import from "@/models/lms/constants".
 */
export * from "@/models/lms/constants";
