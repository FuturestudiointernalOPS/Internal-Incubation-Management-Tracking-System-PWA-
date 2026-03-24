import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const data = await req.json();
    const contacts = Array.isArray(data) ? data : [data];
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validContacts = [];
    const errors = [];
    
    for (const c of contacts) {
      if (!c.email || !emailRegex.test(c.email)) {
        errors.push({ email: c.email, error: 'Invalid email format' });
        continue;
      }
      if (!c.name) {
        errors.push({ email: c.email, error: 'Name is required' });
        continue;
      }
      
      const cid = "USER_" + uuidv4().split('-')[0].toUpperCase() + Math.floor(Math.random() * 10000);
      validContacts.push({
        cid,
        name: c.name,
        email: c.email.toLowerCase(),
        phone: c.phone || null,
        address: c.address || null,
        dob: c.dob || null,
        group_name: c.group_name || null
      });
    }
    
    let inserted = 0;
    for (const vc of validContacts) {
      try {
        // Ensure family exists
        if (vc.group_name) {
          await db.execute({
            sql: "INSERT OR IGNORE INTO families (name) VALUES (?)",
            args: [vc.group_name]
          });
        }

        await db.execute({
          sql: `INSERT INTO contacts (cid, name, email, phone, address, dob, group_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(email) DO UPDATE SET 
                  name = excluded.name, 
                  phone = excluded.phone, 
                  address = excluded.address,
                  dob = excluded.dob,
                  group_name = COALESCE(excluded.group_name, contacts.group_name)`,
          args: [vc.cid, vc.name, vc.email, vc.phone, vc.address, vc.dob, vc.group_name]
        });
        inserted++;
      } catch (err) {
        errors.push({ email: vc.email, error: err.message });
      }
    }
    
    return NextResponse.json({ success: true, inserted, errors });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const result = await db.execute("SELECT * FROM contacts ORDER BY created_at DESC");
    return NextResponse.json({ success: true, contacts: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
