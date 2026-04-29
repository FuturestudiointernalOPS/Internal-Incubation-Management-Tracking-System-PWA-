
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/dev.db');

db.all('SELECT cid, name, email, group_name, role, deleted, created_at FROM contacts ORDER BY created_at DESC LIMIT 10', (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(JSON.stringify(rows, null, 2));
    }
    db.close();
});
