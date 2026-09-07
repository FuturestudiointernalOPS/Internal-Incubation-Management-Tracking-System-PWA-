import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  clearSetupTokenAndSetPassword,
  findContactBySetupToken,
} from "@/models/investorRelations";

export async function POST(req) {
  try {
    await initDb();
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ success: false, error: "Token and password are required." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Find contact with valid setup token
    const result = await findContactBySetupToken(token);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid or expired setup link." }, { status: 404 });
    }

    const contact = result.rows[0];

    // Check expiry
    if (contact.setup_token_expires && new Date(contact.setup_token_expires) < new Date()) {
      return NextResponse.json({ success: false, error: "Setup link has expired. Please contact Future Studio." }, { status: 410 });
    }

    // Hash password and update
    const hashedPassword = await bcrypt.hash(password, 10);
    await clearSetupTokenAndSetPassword(hashedPassword, contact.cid);

    return NextResponse.json({ success: true, message: "Password set successfully." });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
