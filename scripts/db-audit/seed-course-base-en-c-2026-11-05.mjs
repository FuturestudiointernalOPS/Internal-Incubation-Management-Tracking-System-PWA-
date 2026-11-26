// Content for the draft course "base en C": three chapters with lessons and
// one assessment each, plus a final course-level assessment. Same rows the LMS
// models write (createSection / createLesson / createAssessment / createQuestion).
//
//   node scripts/db-audit/seed-course-base-en-c-2026-11-05.mjs            # simulation (rolled back)
//   node scripts/db-audit/seed-course-base-en-c-2026-11-05.mjs --apply    # commits
//
// Video references are real freeCodeCamp videos, checked through YouTube's oEmbed
// endpoint on 2026-11-05. The course stays in draft: nothing is published.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const root = new URL("../../", import.meta.url).pathname;
const require = createRequire(root + "package.json");
const pg = require("pg");

const COURSE_ID = "fdb3d34b-2a15-459e-98f9-7a39a7ee1ace";
const APPLY = process.argv.includes("--apply");

const url = readFileSync(root + ".env.local", "utf-8")
  .split("\n").find((l) => l.startsWith("DATABASE_URL="))?.substring("DATABASE_URL=".length).trim();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const mc = (question, options, correct) => ({
  question,
  options: options.map((text, i) => ({ key: "ABCD"[i], text })),
  correct: ["ABCD"[correct]],
});

const CHAPTERS = [
  {
    title: "Les bases du langage C",
    description: "Structure d'un programme, variables, types, conditions et boucles.",
    lessons: [
      {
        title: "Cours complet pour débutants (freeCodeCamp)",
        description: "Une introduction à tous les concepts de base du C : compilation, variables, fonctions, tableaux, boucles. À regarder au rythme que vous voulez.",
        video: "KJgsSFOSQv0",
        minutes: 226,
      },
      {
        title: "Variables, types et affichage",
        description: "int, float, char ; printf et scanf ; la différence entre déclaration et initialisation.",
      },
      {
        title: "Conditions et boucles",
        description: "if / else, switch, for, while ; écrire un petit programme qui répète une action.",
      },
    ],
    assessment: {
      title: "Évaluation — les bases du C",
      description: "Vérifiez que vous maîtrisez les notions de base avant d'aborder les pointeurs.",
      passMark: 60,
      questions: [
        mc("Quelle fonction de la bibliothèque standard affiche du texte à l'écran ?", ["print()", "printf()", "echo()", "write_text()"], 1),
        mc("Quel type est adapté pour stocker un nombre entier ?", ["char", "float", "int", "string"], 2),
        mc("Quelle boucle s'exécute tant qu'une condition est vraie ?", ["for each", "while", "repeat", "loop"], 1),
        mc("Que doit retourner la fonction main() d'un programme qui s'est bien terminé ?", ["1", "-1", "0", "rien"], 2),
      ],
    },
  },
  {
    title: "Pointeurs et mémoire",
    description: "Comprendre les adresses mémoire, les pointeurs et l'allocation dynamique.",
    lessons: [
      {
        title: "Les pointeurs en C — cours complet",
        description: "Pile, tas, adresses, pointeurs, pointeurs et tableaux, pointeurs de pointeurs. Le cours de référence pour bien comprendre la mémoire.",
        video: "zuegQmMdy8M",
        minutes: 227,
      },
      {
        title: "Allocation dynamique : malloc et free",
        description: "Réserver de la mémoire avec malloc, la libérer avec free, et éviter les fuites mémoire.",
      },
    ],
    assessment: {
      title: "Évaluation — pointeurs et mémoire",
      description: "Pointeurs, adresses et allocation dynamique.",
      passMark: 60,
      questions: [
        mc("Quel opérateur donne l'adresse mémoire d'une variable ?", ["*", "&", "->", "%"], 1),
        mc("Que fait l'opérateur * appliqué à un pointeur ?", ["Il donne l'adresse du pointeur", "Il donne la valeur pointée", "Il multiplie le pointeur", "Il libère la mémoire"], 1),
        mc("Quelle fonction libère un bloc réservé avec malloc ?", ["delete()", "release()", "free()", "clear()"], 2),
        mc("Que se passe-t-il si on oublie de libérer la mémoire réservée avec malloc ?", ["Rien, c'est automatique", "Une fuite mémoire", "Une erreur de compilation", "Le programme s'arrête immédiatement"], 1),
      ],
    },
  },
  {
    title: "Structures et listes chaînées",
    description: "Regrouper des données avec struct, puis construire une liste chaînée.",
    lessons: [
      {
        title: "Les structures (struct)",
        description: "Déclarer une struct, accéder à ses champs avec . et ->, et utiliser typedef pour simplifier l'écriture.",
      },
      {
        title: "Listes chaînées et structures de données (freeCodeCamp)",
        description: "Implémentation d'une liste chaînée en C : insertion, suppression, parcours, inversion. Prérequis : les pointeurs.",
        video: "B31LgI4Y4DQ",
        minutes: 586,
      },
    ],
    assessment: {
      title: "Évaluation — structures et listes chaînées",
      description: "Struct, noeuds et listes chaînées.",
      passMark: 60,
      questions: [
        mc("Quel mot-clé permet de regrouper plusieurs champs dans un même type ?", ["class", "struct", "group", "record"], 1),
        mc("Comment accède-t-on à un champ via un pointeur sur une structure ?", ["p.champ", "p->champ", "p::champ", "p[champ]"], 1),
        mc("Que contient un noeud d'une liste simplement chaînée ?", ["Seulement une valeur", "Une valeur et un pointeur vers le noeud suivant", "Deux valeurs", "Un tableau de noeuds"], 1),
      ],
    },
  },
];

const FINAL = {
  title: "Évaluation finale — base en C",
  description: "Évaluation sur l'ensemble du cours.",
  passMark: 70,
  questions: [
    mc("Quelle commande compile un fichier main.c avec gcc ?", ["gcc main.c -o main", "run main.c", "compile main", "c main.c"], 0),
    mc("Quel est le résultat de sizeof(char) en C ?", ["0", "1", "2", "4"], 1),
    mc("Quelle valeur d'un pointeur indique qu'il ne pointe sur rien ?", ["0xFF", "NULL", "-1", "void"], 1),
    mc("Dans une liste chaînée, que vaut le pointeur suivant du dernier noeud ?", ["Il pointe sur le premier noeud", "NULL", "Il est indéfini", "-1"], 1),
  ],
};

const insertAssessment = async (courseId, sectionId, a, position) => {
  const res = await client.query(
    `INSERT INTO lms_assessments (course_id, section_id, title, description, question_type, position, is_required, pass_mark)
     VALUES ($1,$2,$3,$4,'multiple_choice',$5,true,$6) RETURNING id`,
    [courseId, sectionId, a.title, a.description, position, a.passMark],
  );
  const id = res.rows[0].id;
  for (const [i, q] of a.questions.entries()) {
    await client.query(
      `INSERT INTO lms_assessment_questions (assessment_id, question, question_type, options, correct_answer, points, position)
       VALUES ($1,$2,'multiple_choice',$3::jsonb,$4::jsonb,1,$5)`,
      [id, q.question, JSON.stringify(q.options), JSON.stringify(q.correct), i],
    );
  }
};

await client.connect();
try {
  await client.query("BEGIN");
  const course = await client.query("SELECT title, status FROM lms_courses WHERE id=$1", [COURSE_ID]);
  if (course.rowCount !== 1 || course.rows[0].title !== "base en C") throw new Error("course 'base en C' not found");
  const clash = await client.query(
    "SELECT 1 FROM lms_course_sections WHERE course_id=$1 AND title = ANY($2)",
    [COURSE_ID, CHAPTERS.map((c) => c.title)],
  );
  if (clash.rowCount > 0) throw new Error("a chapter with one of these titles already exists — nothing written");

  const pos = await client.query(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM lms_course_sections WHERE course_id=$1", [COURSE_ID]);
  let sectionPos = pos.rows[0].next;
  const apos = await client.query(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM lms_assessments WHERE course_id=$1", [COURSE_ID]);
  let assessmentPos = apos.rows[0].next;

  for (const chapter of CHAPTERS) {
    const s = await client.query(
      `INSERT INTO lms_course_sections (course_id, title, description, position) VALUES ($1,$2,$3,$4) RETURNING id`,
      [COURSE_ID, chapter.title, chapter.description, sectionPos++],
    );
    const sectionId = s.rows[0].id;
    for (const [i, lesson] of chapter.lessons.entries()) {
      await client.query(
        `INSERT INTO lms_lessons (section_id, title, description, position, is_required, content_type, youtube_video_id, duration_minutes)
         VALUES ($1,$2,$3,$4,true,'video',$5,$6)`,
        [sectionId, lesson.title, lesson.description, i, lesson.video || null, lesson.minutes || null],
      );
    }
    await insertAssessment(COURSE_ID, sectionId, chapter.assessment, assessmentPos++);
    console.log(`ok  chapter "${chapter.title}": ${chapter.lessons.length} lessons, ${chapter.assessment.questions.length} questions`);
  }
  await insertAssessment(COURSE_ID, null, FINAL, assessmentPos++);
  console.log(`ok  final assessment: ${FINAL.questions.length} questions`);

  if (APPLY) {
    await client.query("COMMIT");
    console.log("COMMITTED");
  } else {
    await client.query("ROLLBACK");
    console.log("SIMULATION — rolled back. Re-run with --apply to write.");
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("ROLLED BACK:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
