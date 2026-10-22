import fs from "fs";
import path from "path";
import { requireAuthorization } from "@/models/authorization/index";

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
    const capError = await requireAuthorization("settings", "view");
    if (capError) return capError;
    const db = getDb();
    return Response.json(db);
  } catch {
    return Response.json({ error: "Failed to read DB" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const capError = await requireAuthorization("settings", "edit");
    if (capError) return capError;
    const body = await request.json();
    const { table, data: recordData } = body;
    const db = getDb();

    if (!Object.prototype.hasOwnProperty.call(db, table) || !Array.isArray(db[table])) {
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
