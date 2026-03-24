import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data.json');

function getDb() {
  const data = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(data);
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function GET() {
  try {
    const db = getDb();
    return Response.json(db);
  } catch (error) {
    return Response.json({ error: 'Failed to read DB' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { table, data } = body;
    const db = getDb();
    
    if (!db[table]) {
      return Response.json({ error: 'Invalid table' }, { status: 400 });
    }
    
    const newItem = {
      id: Date.now(),
      ...data
    };
    
    db[table].push(newItem);
    saveDb(db);
    
    return Response.json(newItem);
  } catch (error) {
    return Response.json({ error: 'Failed to update DB' }, { status: 500 });
  }
}
