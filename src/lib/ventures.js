/**
 * Facade — kept during the MVC migration so the ~53 existing importers of
 * "@/lib/ventures" keep resolving unchanged.
 * New code should import from "@/models/ventures".
 */
export * from "@/models/ventures";
