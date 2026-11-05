// Adds YouTube videos to the four text-only lessons of course "base en C".
// Ids checked through YouTube's oEmbed endpoint on 2026-11-05. Course stays draft.
//   node scripts/db-audit/add-videos-base-en-c-2026-11-05.mjs [--apply]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const root = new URL("../../", import.meta.url).pathname;
const pg = createRequire(root + "package.json")("pg");
const COURSE_ID = "fdb3d34b-2a15-459e-98f9-7a39a7ee1ace";
const APPLY = process.argv.includes("--apply");
const VIDEOS = {
  "Variables, types et affichage": "37AO7Uox0FM",
  "Conditions et boucles": "xB3OnNnhDrU",
  "Allocation dynamique : malloc et free": "mbPU0IL9eAo",
  "Les structures (struct)": "e9OXqEPF-5M",
};
const url = readFileSync(root + ".env.local", "utf-8").split("\n").find((l) => l.startsWith("DATABASE_URL="))?.substring(13).trim();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  for (const [title, vid] of Object.entries(VIDEOS)) {
    const r = await client.query(
      `UPDATE lms_lessons l SET youtube_video_id=$1 FROM lms_course_sections s
       WHERE l.section_id=s.id AND s.course_id=$2 AND l.title=$3 AND l.youtube_video_id IS NULL`,
      [vid, COURSE_ID, title]);
    if (r.rowCount !== 1) throw new Error(`"${title}": expected 1 row, got ${r.rowCount}`);
    console.log("ok ", title, "->", vid);
  }
  await client.query(APPLY ? "COMMIT" : "ROLLBACK");
  console.log(APPLY ? "COMMITTED" : "SIMULATION — rolled back");
} catch (e) { await client.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { await client.end(); }
