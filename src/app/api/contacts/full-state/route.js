import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * CONTACTS FULL-STATE API — CENTRAL REGISTRY FEED
 * Aggregates contacts, groups, and families for the Personnel Dashboard.
 */

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const pmId = searchParams.get('pm_id');
    
    console.log("--- FETCHING PERSONNEL STATE ---", pmId ? `(Scoped for PM: ${pmId})` : "(Global)");
    
    let contactsRes;
    let familiesList;
    let teamsRows;

    if (pmId) {
      // 1. Identify assigned programs and segments
      const progRes = await db.execute({
        sql: "SELECT id, name FROM v2_programs WHERE assigned_pm_id = ?",
        args: [pmId]
      });
      const myProgs = progRes.rows;
      const myProgIds = myProgs.map(p => p.id);
      const myProgNames = myProgs.map(p => p.name.toUpperCase());

      // 2. Fetch scoped contacts
      if (myProgIds.length > 0 || myProgNames.length > 0) {
        const idPlaceholders = myProgIds.map(() => "?").join(",") || "NULL";
        const namePlaceholders = myProgNames.map(() => "?").join(",") || "NULL";
        
        contactsRes = await db.execute({
          sql: `SELECT * FROM contacts 
                WHERE program_id IN (${idPlaceholders}) 
                OR UPPER(TRIM(group_name)) IN (${namePlaceholders})
                ORDER BY created_at DESC`,
          args: [...myProgIds, ...myProgNames]
        });

        // 3. Fetch scoped families/segments
        const famRes = await db.execute({
          sql: `SELECT * FROM families 
                WHERE program_id IN (${idPlaceholders})
                OR UPPER(TRIM(name)) IN (${namePlaceholders})`,
          args: [...myProgIds, ...myProgNames]
        });
        familiesList = famRes.rows;

        // 4. Fetch scoped teams
        const teamRes = await db.execute({
          sql: `SELECT id, name, group_name, program_id FROM v2_teams 
                WHERE program_id IN (${idPlaceholders})`,
          args: [...myProgIds]
        });
        teamsRows = teamRes.rows;
      } else {
        contactsRes = { rows: [] };
        familiesList = [];
        teamsRows = [];
      }

    } else {
      // Global View (Super Admin)
      contactsRes = await db.execute("SELECT * FROM contacts ORDER BY created_at DESC");
      const famRes = await db.execute("SELECT * FROM families ORDER BY name ASC");
      familiesList = famRes.rows;
      const teamRes = await db.execute("SELECT id, name, group_name FROM v2_teams");
      teamsRows = teamRes.rows;
    }

    // NORMALIZATION: Ensure FUTURE STUDIO is in the filter list (Uppercase Protocol)
    if (!familiesList.find(f => f.name.toUpperCase() === 'FUTURE STUDIO')) {
      familiesList.unshift({ name: 'FUTURE STUDIO', registration_id: 'R-FS-001' });
    }

    // Data Sanitization: Normalize all contact group names to uppercase
    const normalizedContacts = (contactsRes.rows || []).map(c => ({
      ...c,
      group_name: c.group_name ? c.group_name.toUpperCase() : 'UNASSIGNED'
    }));

    return NextResponse.json({ 
      success: true, 
      contacts: normalizedContacts,
      families: familiesList,
      teams: teamsRows
    });

  } catch (error) {
    console.error("Registry State Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
