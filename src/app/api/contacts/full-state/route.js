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

    // NORMALIZATION: Ensure FUTURE STUDIO is in the filter list (Uppercase Protocol)
    if (!familiesList.find(f => f.name.toUpperCase() === 'FUTURE STUDIO')) {
      familiesList.unshift({ name: 'FUTURE STUDIO', registration_id: 'R-FS-001' });
    }

    // Data Sanitization: Normalize all contact group names to uppercase
    const normalizedContacts = contactsRes.rows.map(c => ({
      ...c,
      group_name: c.group_name ? c.group_name.toUpperCase() : 'UNASSIGNED'
    }));

    return NextResponse.json({ 
      success: true, 
      contacts: normalizedContacts,
      families: familiesList 
    });

  } catch (error) {
    console.error("Full-State Registry Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
