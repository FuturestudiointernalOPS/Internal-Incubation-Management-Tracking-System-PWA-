/**
 * Facade — kept during the layer migration so existing importers of
 * "@/lib/lms/coaching" keep resolving unchanged.
 * New code should import from "@/services/lms/coaching".
 */
export * from "@/services/lms/coaching";
