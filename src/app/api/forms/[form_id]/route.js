import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    const { form_id } = await params;
    await initDb();
    
    const result = await db.execute({
      sql: "SELECT * FROM forms WHERE form_id = ?",
      args: [form_id]
    });
    
    if (result.rows.length === 0) return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
    
    const form = result.rows[0];
    form.schema = JSON.parse(form.schema);
    
    return NextResponse.json({ success: true, form });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
