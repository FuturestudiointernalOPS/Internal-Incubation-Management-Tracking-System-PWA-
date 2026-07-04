import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { insertTransaction } from "@/lib/finance/queries";

export const POST = createHandler({ roles: ["super_admin"] }, async (req) => {
  const body = await req.json();
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
});
