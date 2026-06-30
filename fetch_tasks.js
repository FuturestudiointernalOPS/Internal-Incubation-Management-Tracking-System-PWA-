require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query("SELECT id, title, status, created_week, created_year, user_id FROM tasks;", (err, res) => {
  if (err) console.error(err);
  else console.log(res.rows);
  pool.end();
});
