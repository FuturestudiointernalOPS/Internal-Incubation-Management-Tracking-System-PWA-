import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

/**
 * POST /api/ventures/register
 *
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 *
 * RETIRED (Phase 1): Venture creation only flows through the Forms/Runs
 * intake pipeline (Form → Run → Submission → Review → Approval → Venture).
 * This legacy "Workflow B direct registration" path is closed — even for
 * Super Admin.
 */
export const POST = createHandler(
  { roles: ["super_admin"] },
  async () => {
    // RETIRED (Phase 1): Venture creation only flows through the Forms/Runs
    // intake pipeline (Form → Run → Submission → Review → Approval → Venture).
    // This legacy "Workflow B direct registration" path is closed — even for
    // Super Admin.
    return NextResponse.json(
      {
        success: false,
        code: "LEGACY_FLOW_RETIRED",
        error:
          "Direct Venture registration is retired. Ventures are created only through the Venture Application form approval pipeline.",
      },
      { status: 410 },
    );
  },
);
