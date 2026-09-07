import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { deleteKpi, insertKpi, updateKpi } from "@/models/platformConfig";
export const dynamic = "force-dynamic";

/**
 * KPIs API — STRATEGIC KPI MANAGEMENT
 * CRUD for program key performance indicators.
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    
    const { program_id, title, target_value } = await req.json();
    
    if (!program_id || !title) {
      return NextResponse.json(
        { success: false, error: "program_id and title required" },
        { status: 400 }
      );
    }

    await insertKpi(program_id, title, target_value);

    const session = await getSession();
    await logAuditEvent({
      entity_type: "kpi",
      entity_id: program_id,
      user_id: session.user?.id,
      user_name: session.user?.name,
      action: "create_kpi",
      details: { title, target_value: target_value || 80 },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("KPI POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    
    const { id, title, target_value } = await req.json();
    
    if (!id || !title) {
      return NextResponse.json(
        { success: false, error: "id and title required" },
        { status: 400 }
      );
    }

    await updateKpi(id, title, target_value);

    const session = await getSession();
    await logAuditEvent({
      entity_type: "kpi",
      entity_id: String(id),
      user_id: session.user?.id,
      user_name: session.user?.name,
      action: "update_kpi",
      details: { title, target_value: target_value || 80 },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("KPI PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;
    
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );
    }

    await deleteKpi(id);

    const session = await getSession();
    await logAuditEvent({
      entity_type: "kpi",
      entity_id: String(id),
      user_id: session.user?.id,
      user_name: session.user?.name,
      action: "delete_kpi",
      details: { kpi_id: id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("KPI DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
