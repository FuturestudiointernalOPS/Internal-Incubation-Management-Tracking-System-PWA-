import { createClient } from "@libsql/client";
const db = createClient({ url: "libsql://impactos-db-futurestudiointernalops.aws-us-east-1.turso.io", authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQzMTA3MzEsImlkIjoiMDE5ZDFkMjktMDcwMS03ZTE4LWI3NDktNDE2MzYzZjM4NTdhIiwicmlkIjoiNDZjZDNlNzgtMjM5ZC00ZWZhLWExZDgtODg0ZjY2N2E5N2QzIn0.GChCzmJDq6oIL59sGMY87_JqjdgNjb9D7FPUQk3IA-sR_7MvbR8RRkWP1r74rk2mK159UFpuxz8d1EHM7Bi7DA" });
async function check() {
  const res = await db.execute("SELECT name, email, group_name FROM contacts WHERE email LIKE 'Godwin%'");
  console.log(res.rows);
}
check();
