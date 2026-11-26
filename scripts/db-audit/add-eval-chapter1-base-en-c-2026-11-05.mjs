// Adds the missing chapter assessment to the first chapter of "base en C"
// ("crer une fonction en C"), so every chapter ends with an evaluation.
//   node scripts/db-audit/add-eval-chapter1-base-en-c-2026-11-05.mjs [--apply]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const root = new URL("../../", import.meta.url).pathname;
const pg = createRequire(root + "package.json")("pg");
const COURSE_ID = "fdb3d34b-2a15-459e-98f9-7a39a7ee1ace";
const SECTION_ID = "9d879295-75c1-48be-ab75-381a5c8a420b";
const APPLY = process.argv.includes("--apply");
const mc = (question, options, correct) => ({
  question,
  options: options.map((text, i) => ({ key: "ABCD"[i], text })),
  correct: ["ABCD"[correct]],
});
const QUESTIONS = [
  mc("Quelle est la syntaxe correcte pour déclarer une fonction qui retourne un entier ?", ["int addition(int a, int b)", "function addition(a, b)", "def addition(a, b)", "addition(int a, int b): int"], 0),
  mc("Que signifie le type de retour void ?", ["La fonction retourne 0", "La fonction ne retourne aucune valeur", "La fonction retourne un pointeur", "La fonction est vide et ne peut rien contenir"], 1),
  mc("Quel mot-clé permet de renvoyer une valeur depuis une fonction ?", ["give", "yield", "return", "output"], 2),
  mc("À quoi sert un prototype de fonction ?", ["À déclarer la fonction avant son utilisation", "À libérer la mémoire", "À compiler plus vite", "À créer une variable globale"], 0),
];
const url = readFileSync(root + ".env.local", "utf-8").split("\n").find((l) => l.startsWith("DATABASE_URL="))?.substring(13).trim();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  const sec = await client.query("SELECT 1 FROM lms_course_sections WHERE id=$1 AND course_id=$2", [SECTION_ID, COURSE_ID]);
  if (sec.rowCount !== 1) throw new Error("chapter not found");
  const has = await client.query("SELECT 1 FROM lms_assessments WHERE section_id=$1", [SECTION_ID]);
  if (has.rowCount > 0) throw new Error("this chapter already has an assessment — nothing written");
  const pos = await client.query("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM lms_assessments WHERE course_id=$1", [COURSE_ID]);
  const a = await client.query(
    `INSERT INTO lms_assessments (course_id, section_id, title, description, question_type, position, is_required, pass_mark)
     VALUES ($1,$2,$3,$4,'multiple_choice',$5,true,60) RETURNING id`,
    [COURSE_ID, SECTION_ID, "Évaluation — créer une fonction en C", "Déclarer, définir et appeler une fonction.", pos.rows[0].next]);
  for (const [i, q] of QUESTIONS.entries()) {
    await client.query(
      `INSERT INTO lms_assessment_questions (assessment_id, question, question_type, options, correct_answer, points, position)
       VALUES ($1,$2,'multiple_choice',$3::jsonb,$4::jsonb,1,$5)`,
      [a.rows[0].id, q.question, JSON.stringify(q.options), JSON.stringify(q.correct), i]);
  }
  await client.query(APPLY ? "COMMIT" : "ROLLBACK");
  console.log(APPLY ? "COMMITTED" : "SIMULATION — rolled back", `(${QUESTIONS.length} questions)`);
} catch (e) { await client.query("ROLLBACK"); console.error("ROLLED BACK:", e.message); process.exitCode = 1; }
finally { await client.end(); }
