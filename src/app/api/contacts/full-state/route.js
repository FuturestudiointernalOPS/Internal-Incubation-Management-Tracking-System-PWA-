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
    let familiesList = familiesRes.rows;

    // SOLIDIFICATION: Ensure "FUTURE STUDIO" is a REAL record in the database
    const fsGroup = familiesList.find(f => f.name.toUpperCase() === 'FUTURE STUDIO');
    if (!fsGroup) {
      console.log("Forensic Correction: Creating permanent FUTURE STUDIO group...");
      await db.execute({
        sql: "INSERT INTO families (name, registration_id, type) VALUES (?, ?, ?)",
        args: ['FUTURE STUDIO', 'R-FS-001', 'individual']
      });
      // Re-fetch to get the newly created record with its ID
      const updatedFamilies = await db.execute("SELECT * FROM families ORDER BY name ASC");
      familiesList = updatedFamilies.rows;
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
