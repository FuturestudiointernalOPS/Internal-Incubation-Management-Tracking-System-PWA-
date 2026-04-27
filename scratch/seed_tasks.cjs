const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:local.db' });

async function run() {
  try {
    await db.execute("INSERT INTO v2_standard_types (category, label, status) VALUES ('task', 'Curriculum Coverage', 'active')");
    await db.execute("INSERT INTO v2_standard_types (category, label, status) VALUES ('task', 'Skills Acquisition', 'active')");
    await db.execute("INSERT INTO v2_standard_types (category, label, status) VALUES ('task', 'Milestone Review', 'active')");
    await db.execute("INSERT INTO v2_standard_types (category, label, status) VALUES ('task', 'Practical Session', 'active')");
    console.log('Success');
  } catch (e) {
    console.error(e);
  }
}

run();
