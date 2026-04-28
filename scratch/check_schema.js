const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.all("PRAGMA table_info(families)", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("FAMILIES SCHEMA:");
        console.table(rows);
    }
    db.close();
});
