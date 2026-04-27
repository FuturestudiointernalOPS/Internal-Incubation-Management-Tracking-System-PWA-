const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/Gwin Prod/ImpactOS-FutureStudio/local.db');

const formats = ['PDF', 'Video', 'Document', 'Link', 'URL', 'Image', 'Doc', 'Sheet', 'Slide', 'Media', 'format', 'submission'];

db.serialize(() => {
    formats.forEach(f => {
        db.run("UPDATE v2_standard_types SET category = 'media' WHERE category = 'deliverable' AND label LIKE ?", ['%' + f + '%'], (err) => {
            if (err) console.error(`Error migrating ${f}:`, err);
            else console.log(`Migrated items matching: ${f}`);
        });
    });
});

db.close(() => {
    console.log('Migration Script Finished Execution.');
});
