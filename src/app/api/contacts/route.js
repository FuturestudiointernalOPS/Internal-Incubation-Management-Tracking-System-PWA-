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
      
      // Logins are only initiated when assigned to a group (Program)
      let finalPassword = c.password;
      if (!finalPassword && c.group_name && c.group_name !== 'unassigned') {
         const randomDigits = Math.floor(10000 + Math.random() * 90000);
         finalPassword = `FS${randomDigits}`;
      } else if (!c.group_name || c.group_name === 'unassigned') {
         finalPassword = null; // No login permitted without program assignment
      }

      validContacts.push({
        cid,
        name: c.name || c.fullName,
        email: c.email.toLowerCase(),
        phone: c.phone || null,
        address: c.address || null,
        dob: c.dob || null,
        group_name: c.group_name || null,
        role: c.role || 'unassigned',
        password: finalPassword,
        program_id: c.program_id || null,
        program_name: c.program_name || null,
        image: c.image || null,
        status: c.status || 'approved',
        deleted: !!c.deleted,
        gender: c.gender || null,
        mother_name: c.mother_name || null
      });
    }
    
    let inserted = 0;
    for (const vc of validContacts) {
      try {
        await db.execute({
          sql: `INSERT INTO contacts (
                  cid, name, email, phone, address, dob, group_name, 
                  role, password, program_id, program_name, image, status, deleted, gender, mother_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(email) DO UPDATE SET 
                  name = excluded.name, 
                  phone = excluded.phone, 
                  address = excluded.address,
                  dob = excluded.dob,
                  group_name = excluded.group_name,
                  role = excluded.role,
                  password = excluded.password,
                  program_id = excluded.program_id,
                  program_name = excluded.program_name,
                  image = excluded.image,
                  status = excluded.status,
                  deleted = excluded.deleted,
                  gender = excluded.gender,
                  mother_name = excluded.mother_name`,
          args: [
            vc.cid, vc.name, vc.email, vc.phone, vc.address, vc.dob, vc.group_name,
            vc.role, vc.password, vc.program_id, vc.program_name, vc.image, vc.status, vc.deleted ? 1 : 0, vc.gender, vc.mother_name
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

export async function PUT(req) {
  try {
    await initDb();
    const data = await req.json();
    
    if (!data.cid) {
       return NextResponse.json({ success: false, error: "Contact ID (cid) is required for update." }, { status: 400 });
    }

    // Build dynamic update query
    const fieldsToUpdate = [];
    const args = [];
    
    const updatableColumns = [
       'name', 'email', 'phone', 'address', 'dob', 'group_name', 'role', 
       'password', 'program_id', 'program_name', 'image', 'status', 'deleted', 'gender', 'mother_name'
    ];

    for (const col of updatableColumns) {
       if (data[col] !== undefined) {
          fieldsToUpdate.push(`${col} = ?`);
          args.push(col === 'deleted' ? (data[col] ? 1 : 0) : data[col]);
       }
    }

    if (fieldsToUpdate.length === 0) {
       return NextResponse.json({ success: true, message: "No fields to update." });
    }

    // Add CID for the WHERE clause
    args.push(data.cid);

    const match = await db.execute({
       sql: `UPDATE contacts SET ${fieldsToUpdate.join(', ')} WHERE cid = ?`,
       args: args
    });

    return NextResponse.json({ success: true, rowsAffected: match.rowsAffected });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
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
