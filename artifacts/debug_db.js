import db from './src/lib/db.js';

async function debug() {
  try {
    const email = 'pm-test@impactos.com';
    const res = await db.execute("SELECT * FROM contacts WHERE email = ?", [email]);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
}

debug();
