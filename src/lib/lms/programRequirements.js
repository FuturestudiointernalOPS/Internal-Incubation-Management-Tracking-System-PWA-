/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/programRequirements" keep resolving unchanged.
 * New code should import from "@/models/lms/programRequirements".
 */
export * from "@/models/lms/programRequirements";
