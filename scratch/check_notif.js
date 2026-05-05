
const { initDb, default: db } = require('../src/lib/db');
(async () => {
  try {
    await initDb();
    const res = await db.execute("SELECT * FROM v2_notifications LIMIT 1");
    console.log('Columns:', res.columns);
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
