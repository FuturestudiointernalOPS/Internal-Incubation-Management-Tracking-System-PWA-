/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/standupUpsert" keep resolving unchanged.
 * New code should import from "@/models/standupUpsert".
 */
export * from "@/models/standupUpsert";
