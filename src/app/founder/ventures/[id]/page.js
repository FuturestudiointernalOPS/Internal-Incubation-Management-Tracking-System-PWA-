import FounderVentureWorkspace from "./FounderVentureWorkspace";

export const dynamic = "force-dynamic";

/**
 * /founder/ventures/[id] — the founder's venture workspace.
 *
 * Phase 1 hosts the reporting foundation the founder fills: static profile,
 * founders, team and baseline. The dashboard already links here.
 */
export default function FounderVenturePage() {
  return <FounderVentureWorkspace />;
}
