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
        name: c.name || c.fullName,
        email: c.email.toLowerCase(),
        phone: c.phone || null,
        address: c.address || null,
        dob: c.dob || null,
        group_name: c.group_name || null,
        role: c.role || 'unassigned',
        password: c.password || null,
        program_id: c.program_id || null,
        program_name: c.program_name || null,
        image: c.image || null,
        status: c.status || 'approved',
        deleted: !!c.deleted
      });
    }
    
    let inserted = 0;
    for (const vc of validContacts) {
      try {
        await db.execute({
          sql: `INSERT INTO contacts (
                  cid, name, email, phone, address, dob, group_name, 
                  role, password, program_id, program_name, image, status, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(email) DO UPDATE SET 
                  name = excluded.name, 
                  phone = excluded.phone, 
                  address = excluded.address,
                  dob = excluded.dob,
                  group_name = COALESCE(excluded.group_name, contacts.group_name),
                  role = COALESCE(excluded.role, contacts.role),
                  password = COALESCE(excluded.password, contacts.password),
                  program_id = COALESCE(excluded.program_id, contacts.program_id),
                  program_name = COALESCE(excluded.program_name, contacts.program_name),
                  image = COALESCE(excluded.image, contacts.image),
                  status = excluded.status,
                  deleted = excluded.deleted`,
          args: [
            vc.cid, vc.name, vc.email, vc.phone, vc.address, vc.dob, vc.group_name,
            vc.role, vc.password, vc.program_id, vc.program_name, vc.image, vc.status, vc.deleted ? 1 : 0
          ]
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
