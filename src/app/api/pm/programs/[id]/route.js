import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import {
  ensureProgramFacilitatorsGroup,
  getFacilitatorsForProgram,
  getProgramDetailById,
} from "@/models/programs";

export const GET = createHandler(
  // Outer gate mirrors the program list endpoint's authenticated identities;
  // the capability check below is the actual decision (Phase 3: staff with
  // programs.view — default or individually granted — may view program
  // detail; everyone else is denied by the resolver, not by a hard-coded
  // role list).
  { roles: ["super_admin", "program_manager", "staff"] },
  async (req, { params }) => {
    const capError = await requireAuthorization("programs", "view");
    if (capError) return capError;
    const { id } = await params;
    const result = await getProgramDetailById(id);
    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }

    // Lazy-ensure the program-level Facilitators group exists (system-defined,
    // non-participant representation of the people in v2_program_staff).
    try {
      await ensureProgramFacilitatorsGroup(id);
    } catch (_) {}

    // Program facilitators (external personnel, role='facilitator') — same
    // enrichment as the list endpoint so the PM facilitator management UI
    // can render assigned facilitators and prevent duplicates client-side.
    let facilitators = [];
    try {
      const facilitatorsResult = await getFacilitatorsForProgram(id);
      facilitators = facilitatorsResult.rows.map((facilitator) => {
        let permissions = facilitator.permissions || {};
        if (typeof permissions === "string") {
          try { permissions = JSON.parse(permissions); } catch { permissions = {}; }
        }
        return {
          id: facilitator.id,
          cid: facilitator.staff_id,
          role: facilitator.role || "facilitator",
          permissions,
          name: facilitator.name || facilitator.email || facilitator.staff_id,
          email: facilitator.email || facilitator.staff_id,
        };
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      program: { ...result.rows[0], facilitators },
    });
  },
);
