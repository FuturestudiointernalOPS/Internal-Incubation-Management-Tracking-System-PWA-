const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/Gwin Prod/ImpactOS-FutureStudio/impactos.db');

db.all("SELECT name, assigned_pm_id, assigned_assistant_id FROM v2_programs WHERE assigned_assistant_id LIKE '%68196627%'", [], (err, rows) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
