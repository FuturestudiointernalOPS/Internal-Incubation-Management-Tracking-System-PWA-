const db = require('../src/lib/db');
(async () => {
  try {
    await db.init(); // ensure DB initialized if needed
    const programId = process.argv[2] || 'P-2026-F94A3A0B';
    const result = await db.execute({
      sql: 'SELECT * FROM v2_kpis WHERE program_id = ?',
      args: [programId]
    });
    console.log('KPI rows:', result.rows);
  } catch (e) {
    console.error('Error:', e);
  }
})();
