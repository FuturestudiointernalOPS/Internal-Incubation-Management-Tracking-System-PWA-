/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/ventureInvitations" keep resolving unchanged.
 * New code should import from "@/models/ventureInvitations".
 */
export * from "@/models/ventureInvitations";
export { default } from "@/models/ventureInvitations";
