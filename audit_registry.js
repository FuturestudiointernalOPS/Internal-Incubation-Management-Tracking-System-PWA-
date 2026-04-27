const { createClient } = require('@libsql/client');

async function audit() {
    const db = createClient({ url: 'file:c:/Gwin Prod/ImpactOS-FutureStudio/local.db' });
    const res = await db.execute("SELECT category, label FROM v2_standard_types");
    console.log(JSON.stringify(res.rows, null, 2));
}

audit();
