import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { updateProgramAssignmentColumn } from "@/models/programs";

export const PATCH = createHandler(async (req) => {
  const { program_id, contact_cid, type } = await req.json();
  if (!program_id || !contact_cid) {
    return NextResponse.json(
      { success: false, error: "Program and Contact required." },
      { status: 400 },
    );
  }

  // Deciding WHO manages a program is a program write: the capability alone is
  // not enough (every staff member holds programs.edit), so the perimeter and
  // the capability are decided together. The perimeter is the manager PROFILE
  // (D-4); the platform owner bypasses. See docs/permissions/LOT4-STEP4-2E.md.
  const scopeError = await requireProgramScope({
    programId: program_id,
    wave: "content",
    module: "programs",
    capability: "edit",
  });
  if (scopeError) return scopeError;

  const column = type === "pm" ? "assigned_pm_id" : "assigned_assistant_id";
  await updateProgramAssignmentColumn(column, contact_cid, program_id);
  return NextResponse.json({ success: true });
});
