import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * CONTACTS FULL-STATE API — CENTRAL REGISTRY FEED
 * Aggregates contacts, groups, and families for the Personnel Dashboard.
 */

export async function GET() {
  try {
    await initDb();
    
    console.log("--- FETCHING FULL PERSONNEL STATE ---");

    // 1. Fetch All Contacts (including pending)
    const contactsRes = await db.execute("SELECT * FROM contacts ORDER BY created_at DESC");
    
    // 2. Fetch All Groups/Families (to populate the sidebar filters)
    const familiesRes = await db.execute("SELECT * FROM families ORDER BY name ASC");
    
    // Ensure "FUTURE STUDIO" is always in the list even if empty
    const familiesList = familiesRes.rows;
    if (!familiesList.find(f => f.name.toUpperCase() === 'FUTURE STUDIO')) {
      familiesList.unshift({ name: 'FUTURE STUDIO', registration_id: 'R-FS001' });
    }

    return NextResponse.json({ 
      success: true, 
      contacts: contactsRes.rows,
      families: familiesList 
    });

  } catch (error) {
    console.error("Full-State Registry Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
