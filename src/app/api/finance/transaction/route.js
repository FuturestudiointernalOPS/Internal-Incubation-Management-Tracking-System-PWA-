import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { insertTransaction } from "@/lib/finance/queries";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();

    // Validate required fields
    if (!body.date || !body.amount) {
      return NextResponse.json(
        { success: false, error: "Fields required: date, amount" },
        { status: 400 },
      );
    }

    const result = await insertTransaction({
      date: body.date,
      supplier_client: body.supplier_client || body.supplier || "",
      description: body.description || "",
      category: body.category || body.budgetLine || "",
      budget_code: body.budget_code || null,
      type: body.type || "expense",
      amount: parseFloat(body.amount) || 0,
    });

    return NextResponse.json(
      { success: true, id: result.id, dataSourceId: result.dataSourceId },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
