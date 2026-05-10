import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
export const dynamic = "force-dynamic";

/**
 * CONTACTS API — PERSONNEL REGISTRY
 * Hardened for Gated Onboarding and Real-time Alerts.
 */

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const contacts = Array.isArray(body) ? body : [body];
    
    console.log("--- CONTACT REGISTRATION START ---", { count: contacts.length });

    const validContacts = [];
    const errors = [];
    
    for (const c of contacts) {
      // Mapping for Public Application Form
      const rawName = c.name || c.fullName || 'Unknown Applicant';
      const rawEmail = (c.email || '').toLowerCase().trim();
      
      if (!rawEmail) {
        errors.push({ name: rawName, error: 'Email is required' });
        continue;
      }
      
      const cid = "USER_" + uuidv4().split('-')[0].toUpperCase() + Math.floor(Math.random() * 10000);

      // Credential Provisioning
      let finalPassword = c.password;
      if (!finalPassword) {
         const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
         const prefix = c.role === 'staff' ? 'FSS' : (c.role === 'participant' ? 'FSP' : 'FS');
         finalPassword = `${prefix}${randomStr}`;
      }
      const hashedPassword = await bcrypt.hash(finalPassword, 10);

      // Gated Status Logic (UPPERCASE NORMALIZATION)
      const groupName = (c.group_name || 'unassigned').toUpperCase();
      const isInternal = groupName === 'FUTURE STUDIO';
      const initialStatus = isInternal ? 'pending' : 'approved';
      
      // Strict Role Normalization
      let finalRole = c.role;
      if (!finalRole || finalRole === 'unassigned') {
         finalRole = isInternal ? 'staff' : 'unassigned';
      }

      validContacts.push({
        cid,
        name: rawName.trim(),
        email: rawEmail,
        phone: c.phone || null,
        address: c.address || c.homeAddress || null,
        dob: c.dob || null,
        group_name: groupName,
        role: finalRole,
        password: hashedPassword,
        program_id: c.program_id || null,
        program_name: c.program_name || null,
        image: c.image || null,
        status: initialStatus,
        deleted: 0,
        gender: c.gender || null,
        mother_name: c.mother_name || null
      });
    }
    
    let inserted = 0;
    for (const vc of validContacts) {
      try {
        console.log(`Saving contact: ${vc.email} as ${vc.status}`);
        
        await db.execute({
          sql: `INSERT INTO contacts (
                  cid, name, email, phone, address, dob, group_name, 
                  role, password, program_id, program_name, image, status, deleted, gender, mother_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(email) DO UPDATE SET 
                  name = EXCLUDED.name, 
                  phone = EXCLUDED.phone, 
                  address = EXCLUDED.address,
                  status = EXCLUDED.status,
                  role = EXCLUDED.role,
                  group_name = EXCLUDED.group_name`,
          args: [
            vc.cid, vc.name, vc.email, vc.phone, vc.address, vc.dob, vc.group_name,
            vc.role, vc.password, vc.program_id, vc.program_name, vc.image, vc.status, vc.deleted, vc.gender, vc.mother_name
          ]
        });

        if (vc.status === 'pending') {
           console.log("Triggering Admin Notification for:", vc.name);
           await db.execute({
              sql: `INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)`,
              args: [
                 'sa', 
                 'NEW ACCESS REQUEST',
                 `${vc.name} has applied to join the FUTURE STUDIO group. Verification required.`,
                 'verification'
              ]
           });
        }

        inserted++;
      } catch (err) {
        console.error(`SQL Save Error for ${vc.email}:`, err.message);
        errors.push({ email: vc.email, error: err.message });
      }
    }
    
    if (inserted === 0 && errors.length > 0) {
      console.error("All registrations failed:", errors[0].error);
      return NextResponse.json({ success: false, error: `Database Error: ${errors[0].error}` }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, inserted, errors });
    
  } catch (error) {
    console.error("CRITICAL CONTACTS ERROR:", error.message);
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

    const fieldsToUpdate = [];
    const args = [];
    
    const updatableColumns = [
       'name', 'email', 'phone', 'address', 'dob', 'group_name', 'role', 
       'password', 'program_id', 'program_name', 'image', 'status', 'deleted', 'gender', 'mother_name'
    ];

    for (const col of updatableColumns) {
       if (data[col] !== undefined) {
          if (col === 'password' && data[col] === '') continue;
          
          if (col === 'password') {
             const hashedPassword = await bcrypt.hash(data[col], 10);
             fieldsToUpdate.push(`${col} = ?`);
             args.push(hashedPassword);
          } else {
             fieldsToUpdate.push(`${col} = ?`);
             args.push(col === 'deleted' ? (data[col] ? 1 : 0) : data[col]);
          }
       }
    }

    if (fieldsToUpdate.length === 0) {
       return NextResponse.json({ success: true, message: "No fields to update." });
    }

    args.push(data.cid);

    const match = await db.execute({
       sql: `UPDATE contacts SET ${fieldsToUpdate.join(', ')} WHERE cid = ?`,
       args: args
    });

    // AUTO-PURGE: If status was changed to active/approved, clear related notifications
    if (data.status === 'active' || data.status === 'approved') {
       try {
          // Find the user's name first to match the notification message
          const userRes = await db.execute({
             sql: "SELECT name FROM contacts WHERE cid = ?",
             args: [data.cid]
          });
          if (userRes.rows.length > 0) {
             const userName = userRes.rows[0].name;
             await db.execute({
                sql: `UPDATE v2_notifications 
                      SET read = 1 
                      WHERE recipient_id = 'sa' 
                      AND message ILIKE ? 
                      AND read = 0`,
                args: [`%${userName}%`]
             });
          }
       } catch (e) {
          console.error("Auto-Purge Failure:", e);
       }
    }

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
