import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  hasProgramManagementAccess,
  requireAssignmentAccess,
} from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { requireProgramScope } from "@/lib/programScopedAccess";
import {
  createV2ProgramRecord,
  getV2ProgramDirectory,
  updateV2ProgramRecord,
} from "@/services/programs/workspace";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();

    const serviceRes = await createV2ProgramRecord({ payload: body });

    if (serviceRes.status !== 200) {
      return NextResponse.json(serviceRes.body, { status: serviceRes.status });
    }

    return NextResponse.json(serviceRes.body);
  } catch (error) {
    console.error("V2 Program Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    // Phase 1.2: the program directory is capability-governed — management
    // roles and programs.view holders may list everything; a program-staff
    // session may resolve ONE program via ?id= only when it holds an
    // assignment for that program. Everything else is denied.
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const capError = await requireAuthorization("programs", "view");
    const canReadDirectory = !capError || hasProgramManagementAccess(session?.role);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!canReadDirectory) {
      if (id) {
        const guardError = await requireAssignmentAccess({
          resource: "program",
          contextId: id,
        });
        if (guardError) return guardError;
      } else {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    const serviceRes = await getV2ProgramDirectory({ canReadDirectory, id });
    return NextResponse.json(serviceRes.body, { status: serviceRes.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const data = await req.json();

    if (!data.id) {
      return NextResponse.json(
        { success: false, error: "Program ID is required for update." },
        { status: 400 },
      );
    }

    // Record scope: `staff` authorisation here only says WHICH roles may edit at
    // all — a delegated editor must still be staffed on the program being edited.
    const scopeError = await requireProgramScope({ programId: data.id, wave: "content" });
    if (scopeError) return scopeError;

    const serviceRes = await updateV2ProgramRecord({ payload: data });
    if (serviceRes.status !== 200) {
      return NextResponse.json(serviceRes.body, { status: serviceRes.status });
    }

    return NextResponse.json(serviceRes.body);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
