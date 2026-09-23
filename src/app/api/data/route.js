import fs from "fs";
import path from "path";
import { requireAuth } from "@/lib/auth";

const DB_PATH = path.join(process.cwd(), "data.json");

function getDb() {
  const fileContents = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(fileContents);
}

function saveDb(database) {
  fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), "utf8");
}

export async function GET() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const db = getDb();
    return Response.json(db);
  } catch {
    return Response.json({ error: "Failed to read DB" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const body = await request.json();
    const { table, data: recordData } = body;
    const db = getDb();

    if (!db[table]) {
      return Response.json({ error: "Invalid table" }, { status: 400 });
    }

    const newItem = {
      id: Date.now(),
      ...recordData,
    };

    db[table].push(newItem);
    saveDb(db);

    return Response.json(newItem);
  } catch {
    return Response.json({ error: "Failed to update DB" }, { status: 500 });
  }
}
