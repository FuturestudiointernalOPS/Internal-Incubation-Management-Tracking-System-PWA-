/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/contactGroups" keep resolving unchanged.
 * New code should import from "@/models/contactGroups".
 */
export * from "@/models/contactGroups";
