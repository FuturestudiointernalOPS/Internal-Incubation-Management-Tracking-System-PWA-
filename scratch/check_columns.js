const db = require('../src/lib/db').default;

async function check() {
  try {
    const res = await db.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts'");
    console.log("CONTACTS COLUMNS:", res.rows.map(r => r.column_name));
    
    const res4 = await db.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_document_requirements'");
    console.log("DOCS COLUMNS:", res4.rows);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}

check();
