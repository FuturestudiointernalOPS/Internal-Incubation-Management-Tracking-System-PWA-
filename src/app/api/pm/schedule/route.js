import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import { getOwnSchedule, getSuperAdminSchedule } from "@/models/programWorkspace";

export const GET = createHandler(
  { roles: ["staff", "super_admin", "program_manager", "teacher"] },
  async (req) => {
    try {
      const session = await getSession();

      let sessions;
      if (session?.role === "super_admin") {
        // Full calendar — Super Admin only. Derived from the session role,
        // never from a client-supplied is_super_admin query param (Phase 3C-9).
        sessions = await getSuperAdminSchedule();
      } else {
        // Non-SA: own schedule only — sessions this person handles, or
        // sessions of programs they manage as the assigned PM. Query params
        // (pm_id / teacher_id / is_lead_pm) are ignored: identity comes from
        // the authenticated session, so no one can read another person's
        // schedule by manipulating identifiers (Phase 3C-9).
        const ownCid = session?.cid;
        if (!ownCid) {
          return NextResponse.json(
            { success: false, error: "errors.authRequired" },
            { status: 401 },
          );
        }
        sessions = await getOwnSchedule(ownCid);
      }

      return NextResponse.json({
        success: true,
        schedule: sessions.rows,
      });
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { success: false, error: "Curriculum feature not available in this schema" },
        { status: 501 },
      );
    }
  },
);
