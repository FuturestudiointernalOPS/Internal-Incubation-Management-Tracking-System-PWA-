import db from "@/lib/db";
import { platformProgramPredicate } from "./programScope";
export async function findInternalProgram(programId) {
  return (await db.execute({ sql: `SELECT id FROM v2_programs WHERE id::text=? AND ${platformProgramPredicate()}`,
    args: [String(programId)] })).rows[0] || null;
}
