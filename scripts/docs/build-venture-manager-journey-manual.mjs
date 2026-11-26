#!/usr/bin/env node
/**
 * Venture Manager — the Journey dashboard, a guided manual (PDF).
 *
 * Generates `docs/VENTURE_MANAGER_JOURNEY_MANUAL.pdf`.
 *
 *   node scripts/docs/build-venture-manager-journey-manual.mjs
 *
 * SOURCE OF TRUTH: this script describes the application as built, not as
 * intended. Every claim below was read out of the code before it was written:
 *
 *   src/app/staff/ventures/[id]/page.js          the Venture Manager's tab bar
 *   src/components/ventures/JourneyManagerPanel.js   the Journey tab
 *   src/components/ventures/journey/*            milestone row, inbox, activities
 *   src/components/ventures/workspace/tabs/GrowthTabs.js  roadmap progress
 *   src/components/ventures/VentureNotesPanel.js  internal notes
 *   src/lib/ventureStatuses.js                   the status vocabulary
 *   src/services/ventures/sessionBooking.js       the booking rules
 *   src/services/ventures/reporting/rules.js      the FTE rule referenced in the glossary
 *
 * When the UI changes, change this file with it and regenerate. It is a
 * document, not a second implementation: it never reads the database.
 */

import { jsPDF } from "jspdf";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../docs/VENTURE_MANAGER_JOURNEY_MANUAL.pdf");

// ── Palette (the charter colours, same values as globals.css) ───────────────
const ORANGE = [255, 102, 0];
const INK = [24, 24, 30];
const MUTED = [92, 96, 106];
const FAINT = [138, 142, 152];
const BORDER = [222, 224, 231];
const WASH = [250, 248, 245];
const GREEN = [14, 122, 82];
const ROSE = [176, 52, 62];
const BLUE = [0, 84, 168];

const doc = new jsPDF({ unit: "pt", format: "a4" });
const PAGE_W = doc.internal.pageSize.getWidth();
const PAGE_H = doc.internal.pageSize.getHeight();
const M = 48;
const CONTENT_W = PAGE_W - M * 2;
const FOOT = 34;

let y = M;

const newPage = () => {
  doc.addPage();
  y = M;
};

const ensure = (need) => {
  if (y + need > PAGE_H - M - FOOT) newPage();
};

const ink = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

// ── Typography ─────────────────────────────────────────────────────────────

const body = (text, opts = {}) => {
  const size = opts.size ?? 9.5;
  const indent = opts.indent ?? 0;
  const colour = opts.color ?? INK;
  doc.setFont("helvetica", opts.bold ? "bold" : opts.italic ? "italic" : "normal");
  doc.setFontSize(size);
  ink(colour);
  const lh = size * 1.45;
  const lines = doc.splitTextToSize(String(text), CONTENT_W - indent);
  for (const line of lines) {
    ensure(lh);
    ink(colour);
    doc.text(line, M + indent, y);
    y += lh;
  }
  y += opts.after ?? 6;
};

const h1 = (num, title) => {
  ensure(96);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  ink(ORANGE);
  doc.text(num ? `SECTION ${num}` : "REFERENCE", M, y);
  y += 17;
  doc.setFontSize(17);
  ink(INK);
  doc.text(title, M, y);
  y += 12;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.8);
  doc.line(M, y, PAGE_W - M, y);
  y += 20;
};

const h2 = (title) => {
  ensure(34);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  ink(INK);
  doc.text(title, M, y);
  y += 17;
};

const bullets = (items, opts = {}) => {
  const size = opts.size ?? 9.5;
  const lh = size * 1.45;
  for (const item of items) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(String(item), CONTENT_W - 16);
    ensure(lh * lines.length + 4);
    doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    doc.circle(M + 3, y - size * 0.32, 1.6, "F");
    ink(INK);
    lines.forEach((line) => {
      doc.text(line, M + 14, y);
      y += lh;
    });
    y += 4;
  }
  y += 4;
};

/** Definition rows: a bold term on the left, its explanation on the right. */
const definitions = (rows) => {
  const leftW = 118;
  const rightW = CONTENT_W - leftW;
  for (const [term, text] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const right = doc.splitTextToSize(String(text), rightW);
    const lh = 9 * 1.45;
    const height = Math.max(right.length * lh, lh) + 8;
    ensure(height);
    ink(INK);
    doc.text(term, M, y);
    doc.setFont("helvetica", "normal");
    ink(MUTED);
    let ry = y;
    for (const line of right) {
      doc.text(line, M + leftW, ry);
      ry += lh;
    }
    y += height;
    doc.setDrawColor(240, 241, 245);
    doc.setLineWidth(0.6);
    doc.line(M, y - 4, PAGE_W - M, y - 4);
  }
  y += 8;
};

/** A table with a heavy header rule. Columns are [fraction, label]. */
const table = (columns, rows) => {
  const widths = columns.map(([, , width]) => width * CONTENT_W);
  const lh = 8.6 * 1.4;

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    ink(MUTED);
    let x = M;
    columns.forEach(([, label], index) => {
      doc.text(String(label).toUpperCase(), x, y);
      x += widths[index];
    });
    y += 8;
    doc.setDrawColor(INK[0], INK[1], INK[2]);
    doc.setLineWidth(1);
    doc.line(M, y, PAGE_W - M, y);
    y += 12;
  };

  ensure(40);
  drawHeader();

  for (const row of rows) {
    const cells = row.map((cell, index) => doc.splitTextToSize(String(cell), widths[index] - 10));
    const height = Math.max(...cells.map((cell) => cell.length)) * lh + 8;
    if (y + height > PAGE_H - M - FOOT) {
      newPage();
      drawHeader();
    }
    let x = M;
    cells.forEach((cell, index) => {
      const first = index === 0;
      doc.setFont("helvetica", first ? "bold" : "normal");
      doc.setFontSize(8.6);
      ink(first ? INK : MUTED);
      let cy = y;
      for (const line of cell) {
        doc.text(line, x, cy);
        cy += lh;
      }
      x += widths[index];
    });
    y += height;
    doc.setDrawColor(240, 241, 245);
    doc.setLineWidth(0.6);
    doc.line(M, y - 4, PAGE_W - M, y - 4);
  }
  y += 10;
};

const callout = (title, text, tone = "orange") => {
  const accent = tone === "green" ? GREEN : tone === "rose" ? ROSE : ORANGE;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const lines = (() => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    return doc.splitTextToSize(String(text), CONTENT_W - 40);
  })();
  const height = 22 + lines.length * 13;
  ensure(height + 12);
  doc.setFillColor(WASH[0], WASH[1], WASH[2]);
  doc.rect(M, y - 6, CONTENT_W, height, "F");
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(M, y - 6, 3, height, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  ink(accent);
  doc.text(title, M + 14, y + 8);
  doc.setFont("helvetica", "normal");
  ink(INK);
  let ty = y + 21;
  for (const line of lines) {
    doc.text(line, M + 14, ty);
    ty += 13;
  }
  y += height + 10;
};

const steps = (items) => {
  items.forEach((item, index) => {
    const label = `${index + 1}.`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(String(item), CONTENT_W - 24);
    ensure(14 * lines.length + 6);
    ink(ORANGE);
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal");
    ink(INK);
    lines.forEach((line) => {
      doc.text(line, M + 20, y);
      y += 13.5;
    });
    y += 5;
  });
  y += 4;
};

// ══════════════════════════════════════════════════════════════════════════
// COVER
// ══════════════════════════════════════════════════════════════════════════
doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
doc.rect(0, 0, PAGE_W, 250, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.setTextColor(255, 255, 255);
doc.text("IMPACTOS  ·  VENTURES", M, 74);

doc.setFontSize(34);
doc.text("The Journey Dashboard", M, 132);

doc.setFont("helvetica", "normal");
doc.setFontSize(13);
doc.text("A guided manual for the Venture Manager", M, 164);

doc.setFontSize(9.5);
doc.text("How to read it, run it, and keep it honest.", M, 200);

y = 300;
doc.setFont("helvetica", "bold");
doc.setFontSize(8);
ink(ORANGE);
doc.text("PREPARED FOR", M, y);
y += 16;
body("The Venture Manager (lead manager) of a venture in ImpactOS.", { size: 10.5 });

y += 6;
doc.setFont("helvetica", "bold");
doc.setFontSize(8);
ink(ORANGE);
doc.text("WHAT THIS DOCUMENT COVERS", M, y);
y += 16;
body(
  "The Journey tab of the Venture Manager workspace: what each part means, what the words mean, " +
    "what you are expected to do there each week, and where the founder's view stops and yours begins.",
  { size: 10 },
);

y += 6;
doc.setFont("helvetica", "bold");
doc.setFontSize(8);
ink(ORANGE);
doc.text("WHAT IT IS NOT", M, y);
y += 16;
body(
  "It is not a specification and it invents nothing. Every behaviour described here was read out of " +
    "the application's own code. Where a rule is enforced by the server, the manual says so.",
  { size: 10 },
);

y += 18;
doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
doc.setLineWidth(0.8);
doc.line(M, y, PAGE_W - M, y);
y += 18;

doc.setFont("helvetica", "normal");
doc.setFontSize(8.5);
ink(FAINT);
doc.text("Build: Ventures, commit 7b138936a and the work described in section 10", M, y);
y += 13;
doc.text("Regenerate with: node scripts/docs/build-venture-manager-journey-manual.mjs", M, y);

// ══════════════════════════════════════════════════════════════════════════
// CONTENTS
// ══════════════════════════════════════════════════════════════════════════
newPage();
doc.setFont("helvetica", "bold");
doc.setFontSize(17);
ink(INK);
doc.text("Contents", M, y + 4);
y += 26;
doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
doc.setLineWidth(0.8);
doc.line(M, y, PAGE_W - M, y);
y += 24;

const CONTENTS = [
  ["1", "What the Journey is", "the plan of record, and the two numbers that measure it"],
  ["2", "Where the Journey lives", "the Venture Manager's tab bar"],
  ["3", "The Journey tab at a glance", "the roadmap card, then the stages"],
  ["4", "The vocabulary", "one word, one thing"],
  ["5", "The eight status words", "what each one means and what you do about it"],
  ["6", "Working a Journey (a stage)", "dates, reports, archiving"],
  ["7", "Working a milestone", "opening it, the menu, completing it"],
  ["8", "Reviewing what the venture submitted", "approve, or ask for changes"],
  ["9", "Deliverables", "evidence, dates, and the words you may set"],
  ["10", "The three buttons on an activity", "Quick note, Activity report, Session"],
  ["11", "Booking a session", "the rules, and what a session holds"],
  ["12", "The Notes tab", "Milestone notes, Activity reports, Session memos"],
  ["13", "Journey reports", "progress and closing reports"],
  ["14", "Templates and the archive", "reuse a plan, retire a plan"],
  ["15", "What the founder sees", "and what they never see"],
  ["16", "Your week in the Journey", "a routine that takes twenty minutes"],
  ["17", "If something looks wrong", "the five questions we get most"],
  ["", "Glossary (English / French)", "the same words in both languages"],
];

CONTENTS.forEach(([num, title, blurb]) => {
  ensure(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  ink(ORANGE);
  if (num) doc.text(num.padStart(2, " "), M, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  ink(INK);
  doc.text(title, M + 26, y);
  y += 12.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  ink(FAINT);
  doc.text(blurb, M + 26, y);
  y += 11;
});

// ══════════════════════════════════════════════════════════════════════════
// 1
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(1, "What the Journey is");

body(
  "The Journey is the venture's plan of record: the sequence of stages the studio guides a venture " +
    "through, from setting up a legal company to scaling one. It is the thing you and the founder " +
    "actually work on together, week after week.",
);
body(
  "It is deliberately not a document. A plan in a document says what was agreed last quarter. The " +
    "Journey says what is true this morning: which stage is running, which milestone is open, which " +
    "deliverable is waiting for your decision, which session is booked for Thursday.",
);

h2("Two numbers, two questions, never one number");
definitions([
  [
    "Roadmap progress",
    "How much of the planned work is done. It counts journeys, milestones, tasks and deliverables that have actually been completed or approved. It is a measure of execution.",
  ],
  [
    "Data Room readiness",
    "How much of the required Data Room is filed and verified. It is a measure of fundraising preparedness, and it lives in the Data Room tab, next to the documents that produce it.",
  ],
]);

callout(
  "Why they are kept apart",
  "A venture can execute beautifully and still not be ready to raise, or file every document and " +
    "deliver nothing. Merging the two into one scoreboard number would hide exactly the thing you " +
    "need to see. The application computes them from two different engines and never averages them.",
);

h2("What the Journey is for, in one line");
body(
  "So that a founder, a Venture Manager and the Super Admin can look at the same screen and agree on " +
    "what is done, what is late, and what happens next.",
);

// ══════════════════════════════════════════════════════════════════════════
// 2
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(2, "Where the Journey lives");

body(
  "Open Ventures in the sidebar, choose the venture, and you land on its workspace. The tab bar is " +
    "the whole venture; the Journey is one door in it. Your rights inside each tab come from your " +
    "staff assignment on that venture, and the server enforces them - the tab bar only decides what " +
    "is worth showing you.",
);

table(
  [
    ["Tab", "What it answers", 0.26],
    ["What it holds", "", 0.62],
  ],
  [
    ["Overview", "What needs me today?", "Four figures, the decisions waiting on you, a snapshot of the venture, and the venture's reported numbers as charts. Start here every morning."],
    ["Journey", "Where is the plan?", "Roadmap progress, then every stage of the plan with its milestones, deliverables, sessions and reports. This manual is about this tab."],
    ["Projects", "The work as a list", "The same milestones, activities and deliverables as rows and as a timeline. Lead manager only."],
    ["Tasks", "Who is doing what", "The board for the venture's tasks, linked to milestones."],
    ["Sessions", "What meetings happened", "Every booked session with its coach, materials and its one memo, plus the coach's write-up."],
    ["Notes", "What we wrote down", "Internal, staff-only notes: Milestone notes, Activity reports, Session memos."],
    ["Data Room", "Are we ready to raise?", "Data Room readiness at the top, then the document categories themselves."],
    ["Profile", "Who the venture is", "The founder's profile, read-only: you follow the venture without owning its record. Lead manager only."],
  ],
);

callout(
  "Projects and Profile",
  "Those two tabs appear only for the venture's lead manager. If a colleague does not see them, that " +
    "is the assignment talking, not a bug.",
);

// ══════════════════════════════════════════════════════════════════════════
// 3
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(3, "The Journey tab at a glance");

body("The tab has two layers, top to bottom.");

h2("The roadmap card (top)");
body(
  "A single percentage and four bars. It answers one question: how much of the planned work is " +
    "actually done. Read it as a thermometer, never as a grade.",
);
table(
  [
    ["Bar", "Counts", 0.24],
    ["What has to happen for it to move", "", 0.64],
  ],
  [
    ["Journeys", "Stages", "A stage reaches its end: every one of its milestones is complete."],
    ["Milestones", "Milestones", "A milestone closes - either you mark it complete, or the work behind it finishes and the system closes it."],
    ["Tasks", "Tasks", "A task reaches a completed status (done, or accepted through review)."],
    ["Deliverables", "Deliverables", "A deliverable is approved. Submitted is not approved: review is what counts."],
  ],
);

callout(
  "A percentage that will not move",
  "If you approved nothing this week, the card does not move - and that is the correct answer. It " +
    "measures finished work, not effort, meetings attended, or how busy everyone felt.",
  "green",
);

h2("The stages (below the card)");
body(
  "Each stage is a block you can open. It shows its own status, its dates, its milestones and its " +
    "journey reports. Several stages can be running at the same time: stages do not wait for one " +
    "another, they start when their own start date arrives.",
);

callout(
  "Managing the plan itself",
  "The Journey tab is also where the plan is edited: stages and milestones are added, renamed, " +
    "reordered and completed here. The server checks that you may manage milestones on this venture " +
    "before any of it is written.",
);

// ══════════════════════════════════════════════════════════════════════════
// 4
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(4, "The vocabulary");

body(
  "Six words cover everything on this screen. They nest, and each one only ever means one thing. " +
    "Learn the ladder and the rest of the manual reads itself.",
);

definitions([
  ["Journey", "A stage of the plan - for example Foundation & Compliance, Validation, Early Traction. In the interface a stage is labelled Journey. It has a start date, an end date and a status."],
  ["Milestone", "A checkpoint inside a stage. It is the unit of completion: a stage ends when its milestones do. Milestones are what the review inbox, the deliverables and the sessions are attached to."],
  ["Activity", "A specific piece of work inside a milestone - for example FT-01 Register the company. Deliverables belong to an activity, and the three action buttons (note, report, session) sit on it."],
  ["Deliverable", "The artefact an activity must produce: a document, a link, a proof. It has dates, a status and evidence, and it is approved by you."],
  ["Task", "A to-do assigned to a person. Tasks live on the Tasks tab and can be linked to a milestone. A task can require a submission."],
  ["Submission", "What a founder files for a task that requires review. You approve it or send it back with a written reason."],
]);

h2("Three more words that are not part of the ladder");
definitions([
  ["Session", "A dated meeting between the venture and a coach or advisor, always attached to a milestone. It holds one memo, materials, and the coach's write-up."],
  ["Note", "An internal, staff-only piece of writing attached to a milestone. Founders never see it."],
  ["Journey report", "A structured progress or closing report for a whole stage. It goes to the studio, not to the venture's timeline."],
]);

callout(
  "The word 'Journey' does double duty",
  "The tab is called Journey, and each stage inside it is also called a Journey. When a colleague " +
  "says 'the Journey is complete', ask which one they mean. The interface shows the stage's own " +
  "status, so the answer is always on screen.",
);

// ══════════════════════════════════════════════════════════════════════════
// 5
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(5, "The eight status words");

body(
  "Statuses are stored as fixed values and shown as eight words. The application never guesses a " +
    "word for an unknown value: it shows the raw value instead, so you can report it rather than be " +
    "misled by it.",
);

table(
  [
    ["Word", "Means", 0.2],
    ["What you do", "", 0.68],
  ],
  [
    ["Upcoming", "The stage it belongs to has not started yet: its start date has not arrived.", "Nothing. It is released by the calendar, not by you."],
    ["Blocked", "The work is due, but a dependency it declares is not complete.", "Resolve the dependency. Moving it up or down the list will not release it."],
    ["Not started", "Released, nobody has begun.", "Assign it, or move it to In progress once work really starts."],
    ["In progress", "Work is under way.", "Watch the dates. This is the state that hides slippage."],
    ["Awaiting review", "Something was submitted and is waiting for a decision.", "Decide it. This is your queue."],
    ["Changes requested", "You sent it back with a written reason.", "The founder resubmits a new version. Nothing was deleted."],
    ["Completed", "Done and closed.", "Nothing. It counts in roadmap progress."],
    ["Approved", "Accepted after review.", "Nothing. It counts in roadmap progress."],
  ],
);

callout(
  "Not started is not the same as upcoming",
  "Upcoming is the calendar holding the work back. Not started is you and the founder not having " +
    "begun. They look similar in a list and they mean opposite things in a meeting.",
);

// ══════════════════════════════════════════════════════════════════════════
// 6
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(6, "Working a Journey (a stage)");

h2("How a stage starts and ends");
steps([
  "A stage is created with a start date and an end date. Until the start date arrives it is Upcoming and its milestones are held.",
  "On its start date it becomes Active on its own. Nobody presses a button; the screen releases it the first time it is read that day.",
  "It becomes Completed when all of its milestones are complete.",
  "Several stages can be active at once. A venture does not have to finish Validation before starting Foundation work, unless a milestone declares that dependency.",
]);

h2("What you can do on a stage");
bullets([
  "Add, rename, reorder and delete stages and milestones.",
  "Attach a journey report to the stage - a progress report while it runs, a closing report when it ends (section 13).",
  "Archive a stage you do not want in the working view, and restore it later (section 14).",
  "Save the whole Journey as a template, or start a new venture from one (section 14).",
]);

callout(
  "Reordering is not rescheduling",
  "Moving a milestone up or down changes the order you read it in. It does not change dates and it " +
  "does not release a blocked milestone. Only a completed dependency does that.",
);

// ══════════════════════════════════════════════════════════════════════════
// 7
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(7, "Working a milestone");

body(
  "A milestone is where everything you actually do is attached. Click it to open it. When it is " +
    "open you get, in one place: what needs your decision, the deliverables of each activity, the " +
    "sessions booked on it, and its internal notes.",
);

h2("The milestone menu");
table(
  [
    ["Item", "What it does", 0.24],
    ["Use it when", "", 0.64],
  ],
  [
    ["Edit", "Change the title, description, dates, owner or dependency.", "The plan is wrong, not the work."],
    ["Move up / Move down", "Reorder it within its stage.", "You are reshaping the reading order only."],
    ["Notes", "Open this milestone's internal notes in place.", "You have just come out of a call and need to write down what was decided."],
    ["Mark completed", "Close it as done.", "The work is genuinely finished and you can say why."],
  ],
);

h2("Closing a milestone");
body(
  "You have two routes to a closed milestone, and they agree with each other. Either you mark it " +
    "completed, or its deliverables are approved and its tasks are done and the system closes it when " +
    "the Journey is next read. A milestone left half-closed is a signal, not a state to live in.",
);

callout(
  "Do not close a milestone to make the card look better",
  "Roadmap progress is read side by side with the founder's own numbers and by the Super Admin. A " +
    "milestone closed over unfinished work buys a better percentage this week and an uncomfortable " +
    "meeting at the end of the stage.",
  "rose",
);

h2("Submissions in the milestone");
body(
  "If a task inside the milestone requires review, whatever the founder files appears at the top of " +
    "the open milestone, in an amber block. That is section 8.",
);

// ══════════════════════════════════════════════════════════════════════════
// 8
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(8, "Reviewing what the venture submitted");

body(
  "Submissions sit in the open milestone, not in a separate queue you have to remember to check. " +
    "Each row tells you the task, the version, who filed it and when, the founder's own note, and a " +
    "link to the file if there is one.",
);

h2("The two decisions");
definitions([
  ["Approve", "The deliverable is accepted. The row leaves your queue and the work counts as done."],
  ["Request changes", "You must write what has to change. The founder sees it, fixes it and files a new version. The old version is kept - nothing is overwritten or deleted."],
]);

callout(
  "Write the reason as an instruction",
  "'Not good enough' produces another round. 'Add the bank statement for August and the registration " +
    "certificate' produces an approval. The comment is the deliverable of your review.",
);

h2("Versions");
body(
  "Every submission carries a version number. A request for changes does not replace the previous " +
    "submission: it becomes version 2 of the same task, and the history stays readable. When you are " +
    "asked 'who approved v1?', the answer is still there.",
);

h2("What a review is not");
bullets([
  "It is not a second opinion on the business idea. You are checking that the artefact exists, is the right one, and is real.",
  "It is not permanent. An approval can be revisited through a new submission; the audit trail shows both decisions.",
  "It is not optional for review-required tasks: the task cannot close without a decision.",
]);

// ══════════════════════════════════════════════════════════════════════════
// 9
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(9, "Deliverables");

body(
  "A deliverable is the artefact an activity must produce. It carries two dates (a start and an end), " +
    "a status, and evidence - a file, or a link.",
);

h2("The words you may set, and the ones you may not");
table(
  [
    ["Status", "Who sets it", 0.2],
    ["What it means", "", 0.66],
  ],
  [
    ["Not started", "You", "Nothing has begun on this artefact."],
    ["In progress", "You", "Someone is working on it."],
    ["Blocked", "You", "It cannot proceed - say what is missing in the note."],
    ["Awaiting review", "The founder, by submitting", "Filed and waiting for your decision."],
    ["Changes requested", "You, by requesting changes", "Sent back with a written reason."],
    ["Approved", "The review only", "Accepted. This is what moves roadmap progress."],
  ],
);

callout(
  "You cannot type 'Approved'",
  "Approval is the outcome of a review, not a field you may set. That is deliberate: it keeps the " +
  "roadmap percentage traceable to a decision with a name and a date on it.",
);

h2("Evidence is private");
body(
  "Uploaded files are never public links. An authorised staff member opening the evidence gets a " +
    "short-lived signed address, generated at the moment of reading. If a link stops working after an " +
    "hour, that is the system working as designed - reopen the deliverable.",
);

// ══════════════════════════════════════════════════════════════════════════
// 10
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(10, "The three buttons on an activity");

body(
  "Under each activity in an open milestone you will find three actions. They look similar and they " +
    "stored different things, which is why they were renamed. This is the section to read twice.",
);

table(
  [
    ["Button", "What it creates", 0.2],
    ["Who can read it", "", 0.34],
    ["Where it appears afterwards", "", 0.34],
  ],
  [
    ["Quick note", "A short internal note filed on the milestone.", "Staff only", "Notes tab, Milestone notes"],
    ["Activity report", "A fuller internal report filed on the milestone, titled with the activity code", "Staff only", "Notes tab, Activity reports"],
    ["Session", "A booked coaching session attached to the milestone", "Staff and the venture", "Sessions tab; also listed on the milestone"],
  ],
);

h2("Why 'Activity report' and not 'Report'");
body(
  "Because there is a third thing called a journey report (section 13), which is a structured report " +
    "for a whole stage. Two different objects sharing the word 'report' is how a manager ends up " +
    "looking in the wrong place. The activity one is now named in full.",
);

callout(
  "The same row, two names, no longer",
  "An activity report is stored as an internal note with a kind of 'activity'. Before that distinction " +
    "existed, the Notes tab could not tell an activity report from a note written on the milestone " +
    "itself, because both are filed in exactly the same place. Now it can, and the two are listed " +
  "separately. Nothing was rewritten: reports written before the change appear under Milestone notes.",
  "green",
);

h2("Which one do I want?");
bullets([
  "You were in a meeting and need to record what was said - Quick note.",
  "You visited a bank, assessed a deliverable against a checklist, or documented a decision about one activity - Activity report.",
  "You need to sit down with the founder or a coach about this activity - Session.",
]);

// ══════════════════════════════════════════════════════════════════════════
// 11
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(11, "Booking a session");

body(
  "A session is a dated meeting between the venture and a coach or advisor. The server refuses a " +
    "session that does not meet four rules, and it refuses them for founders exactly as it does for you.",
);

h2("The four rules");
definitions([
  ["A memo is required", "A session without a note about why it exists is not created. The memo is what the venture is told to expect."],
  ["It belongs to a milestone", "Sessions never exist outside the plan. If you cannot pick a milestone, the milestone is missing - create it first."],
  ["A date and a time, not in the past", "Any future time is bookable. The booker decides; the system only refuses yesterday."],
  ["Materials are validated", "Up to five documents, and only files issued by this venture's own session upload. An arbitrary address is refused."],
]);

h2("What a session holds");
bullets([
  "Its one memo - the brief. It is edited in place, never appended to: a session does not accumulate briefs.",
  "Its materials, shared as private signed links.",
  "Its invitees, so you can see who was told.",
  "The coach's feedback, written from the Sessions tab, which is separate from the memo and keeps its author and date.",
]);

callout(
  "Where the two write-ups appear",
  "The memo and the coach feedback both live with the session, and both are now readable in one " +
    "place: Notes, Session memos. Before, the feedback was written from the Sessions tab and readable " +
    "nowhere else.",
);

h2("Cancelling and moving");
body(
  "A cancelled session leaves everyone's calendar; the record stays with a cancelled status. A moved " +
  "session is pushed to the calendars of the booker and the coach immediately, because a calendar " +
    "that keeps the old slot is worse than no entry at all.",
);

// ══════════════════════════════════════════════════════════════════════════
// 12
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(12, "The Notes tab");

body(
  "Everything written by staff about a venture, in three sections. It is staff-only: the founder's " +
    "account is refused by the server, not merely hidden by the interface.",
);

table(
  [
    ["Section", "Holds", 0.22],
    ["Written from", "", 0.72],
  ],
  [
    ["Milestone notes", "A note about the milestone itself.", "The New note button in this tab, or the Notes item in a milestone's menu."],
    ["Activity reports", "A staff report about one activity, still filed on that activity's milestone.", "The Activity report button on an activity."],
    ["Session memos", "The memo of each session, and the coach's feedback on it.", "Booking or editing a session, and the Sessions tab."],
  ],
);

h2("The one rule that shapes everything");
body(
  "An internal note must belong to a milestone. There are no venture-wide notes and no free-floating " +
    "ones. It is not a filing preference: the server refuses any other scope. If you want to write " +
    "something that is not about a milestone, it is not a note - it is a journey report, or it is a " +
    "message to the founder on a channel they can read.",
);

callout(
  "Notes are not messages",
  "The founder never receives them and there is no way to share one from here. If the founder needs " +
    "to know something, write it where they can read it: their reporting narrative, a comment on a " +
    "submission, or a session memo.",
  "rose",
);

h2("Who can read and write a note");
table(
  [
    ["Role", "Reads", 0.24],
    ["Adds", "", 0.22],
    ["Removes", "", 0.46],
  ],
  [
    ["Super Admin", "Every note of every venture", "yes", "yes"],
    ["Venture Manager (assigned)", "The whole venture", "yes", "yes - any note"],
    ["Coach (assigned, scoped)", "Only the milestones in their assignment", "yes", "their own note only"],
    ["Facilitator (assigned, scoped)", "Only the milestones in their assignment", "yes", "their own note only"],
    ["Founder / team member", "Nothing - the server answers 404", "no", "no"],
    ["Any other staff member", "Nothing - an active assignment is required", "no", "no"],
  ],
);

h2("Writing one");
steps([
  "Choose New note, pick the milestone, give it a title and a body.",
  "Attach a link or a file if there is evidence.",
  "Save. It appears in Milestone notes, newest first.",
  "Deleting asks you to confirm first. What it actually does is archive the note: it disappears from every list and the row is kept, so an accidental delete is recoverable rather than retyped. A coach may retract their own note; removing someone else's needs the delete right.",
]);

// ══════════════════════════════════════════════════════════════════════════
// 13
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(13, "Journey reports");

body(
  "A journey report is the written account of a stage: what the stage set out to do, what happened, " +
    "and what you recommend. It is addressed to the studio, and it is the only structured report in " +
    "the Journey tab.",
);

h2("Two kinds");
definitions([
  ["Progress report", "Written while the stage runs. It says where the stage has got to and what is outstanding."],
  ["Closing report", "Written when the stage ends. It is the account of the stage as a whole."],
]);

h2("What it records");
bullets([
  "A title and the reporting period.",
  "A summary of the stage.",
  "What was completed, and what is outstanding.",
  "Support delivered, challenges met, and your recommendation.",
  "A status: draft while you write, submitted when it goes to the studio, with the date it was submitted.",
]);

callout(
  "The report a stage is owed",
  "If a stage closes without its closing report, the Journey tab says so, in place, in amber. Nothing " +
    "is blocked and no work is lost - the omission is simply never silent.",
);

h2("How it differs from the other two reports");
table(
  [
    ["Report", "Scope", 0.26],
    ["Audience", "", 0.66],
  ],
  [
    ["Activity report", "One activity", "Staff only, inside the venture's notes"],
    ["Journey report", "One whole stage", "The studio, through the submitted report"],
    ["The founder's reporting", "The venture's numbers", "Everyone who reads the venture's record"],
  ],
);

// ══════════════════════════════════════════════════════════════════════════
// 14
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(14, "Templates and the archive");

h2("Templates");
body(
  "A good plan is worth reusing. A Journey can be saved as a template, and a new venture can start " +
    "from one instead of an empty page. Templates are blueprints: applying one copies its structure " +
    "into the venture, and later edits to the venture never change the template.",
);

h2("The archive");
body(
  "Archiving takes a stage out of the working view without deleting anything. The Journey tab offers " +
    "an Active view and an Archived view, and archived material comes back only when you ask for it.",
);
bullets([
  "Select all, or select individual stages, then archive them together.",
  "Bulk delete exists and asks twice before it runs - the second confirmation is there because deletion is not reversible.",
  "Archived milestones are likewise hidden from the working view unless the manager explicitly asks for archived content.",
]);

callout(
  "Archive is the habitual choice",
  "A stage you finished, a plan you replaced, a milestone that was really an experiment: archive them. " +
    "Delete is for things that were created by mistake.",
);

// ══════════════════════════════════════════════════════════════════════════
// 15
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(15, "What the founder sees");

body(
  "The founder has their own workspace and their own Journey tab. It shows their roadmap, their " +
    "milestones, their deliverables, the sessions they can book, and their tasks.",
);

h2("The line between you");
table(
  [
    ["Visible to the founder", "Staff only", 0.48],
    ["", "", 0.52],
  ],
  [
    ["The plan: stages, milestones, activities, deliverables, dates", "Internal notes"],
    ["The sessions they are invited to, and each session's memo", "Activity reports"],
    ["Their own submissions and your written decisions", "Coach feedback"],
    ["The Data Room and its readiness figure", "Journey reports addressed to the studio"],
    ["Their own reporting figures", "Readiness of other ventures, portfolio figures"],
  ],
);

callout(
  "The founder's numbers are theirs",
  "You read the venture's reported figures through the charts on Overview; the reporting forms belong " +
    "to the founder. If a number looks wrong, the fix is a correction through the reporting flow, not " +
    "an edit on your side.",
);

h2("When a founder says 'I cannot see it'");
body(
  "Nine times in ten the answer is one of three things: the stage or milestone is still Upcoming, it " +
    "was archived, or the material is internal by design. Check those three before opening a ticket.",
);

// ══════════════════════════════════════════════════════════════════════════
// 16
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(16, "Your week in the Journey");

body("A routine that keeps the plan true, in about twenty minutes.");

h2("Every Monday");
steps([
  "Open Overview. Clear the decision list - every submission waiting on you is a founder who cannot move.",
  "Open Journey. Look at the roadmap card. If it did not move last week, ask which of the four bars should have.",
  "Open each active stage and check the milestones due this week. Anything In progress with an end date in the past is the conversation.",
  "Open Sessions. Confirm what is booked, and that every session on the calendar has a memo worth reading.",
]);

h2("After every session");
steps([
  "Write the memo if the coach has not - one memo per session, edited in place.",
  "Add the coach's feedback from the Sessions tab if it was given verbally.",
  "If the session produced a decision about one activity, write it as an Activity report on that activity.",
]);

h2("At the end of a stage");
steps([
  "Confirm every milestone is closed, or record why one is not.",
  "Write the closing report - summary, completed, outstanding, challenges, recommendation.",
  "Archive the stage if the working view is getting long.",
]);

h2("Monthly");
bullets([
  "Read the founder's reported figures against the roadmap. Execution and numbers disagreeing is information, not an error.",
  "Check the Data Room readiness card. A venture about to raise with an unverified Data Room is the most expensive surprise in the building.",
]);

// ══════════════════════════════════════════════════════════════════════════
// 17
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1(17, "If something looks wrong");

h2("A stage or milestone is missing")
body(
  "Check its status first: while it is Upcoming it is held by its start date and its milestones are " +
    "not released. Then check the archive. Only then treat it as a defect.",
);

h2("The roadmap percentage did not move")
body(
  "It only counts completed milestones, completed tasks and approved deliverables. A submitted " +
    "deliverable is not approved. A milestone with all its work done closes on the next read, not the " +
    "instant the last approval lands.",
);

h2("I wrote a note and cannot find it")
body(
  "Notes has three sections now. An activity report written from an activity is under Activity " +
    "reports, not Milestone notes. A session write-up is under Session memos. Reports written before " +
    "the sections existed are under Milestone notes.",
);

h2("A session will not save")
body(
  "Four rules, and the message names the one that failed: the memo is empty, no milestone was chosen, " +
    "the date and time is in the past, or a material was not uploaded through the session uploader.",
);

h2("The founder cannot see a note or a report")
body(
  "That is by design. Internal notes, activity reports, coach feedback and journey reports are staff " +
    "instruments. If the founder needs the content, put it where they can read it.",
);

callout(
  "Report a defect with three facts",
  "What you expected, what you saw, and the venture code plus the milestone or activity name. The " +
    "venture code is on the header of every screen; with it, a developer can find the row in minutes.",
  "green",
);

// ══════════════════════════════════════════════════════════════════════════
// GLOSSARY
// ══════════════════════════════════════════════════════════════════════════
newPage();
h1("", "Glossary - English / French");

body(
  "The interface is bilingual. These are the words as they appear in the two languages, taken from " +
    "the application's own translation files.",
);

table(
  [
    ["English", "French", 0.32],
    ["Note", "", 0.52],
  ],
  [
    ["Journey (tab)", "Parcours", ""],
    ["Journey (a stage)", "Parcours / étape du parcours", ""],
    ["Milestone", "Jalon", ""],
    ["Activity", "Activité", ""],
    ["Deliverable", "Livrable", ""],
    ["Task", "Tâche", ""],
    ["Session", "Session (séance)", "the tab is called Sessions in both languages"],
    ["Milestone note", "Note de jalon", ""],
    ["Activity report", "Rapport d'activité", ""],
    ["Session memo", "Compte rendu de séance", ""],
    ["Journey report", "Rapport de parcours", ""],
    ["Closing report", "Rapport de clôture", ""],
    ["Roadmap progress", "Avancement du parcours", ""],
    ["Data Room readiness", "Complétude du Data Room", ""],
    ["Approved", "Approuvé", ""],
    ["Awaiting review", "En attente de revue", ""],
    ["Changes requested", "Modifications demandées", ""],
    ["Blocked", "Bloqué", ""],
    ["Upcoming", "À venir", ""],
    ["Not started", "Non commencé", ""],
    ["In progress", "En cours", ""],
    ["Completed", "Terminé", ""],
  ],
);

y += 6;
doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
doc.setLineWidth(0.8);
doc.line(M, y, PAGE_W - M, y);
y += 20;

doc.setFont("helvetica", "italic");
doc.setFontSize(8.5);
ink(FAINT);
const closing = doc.splitTextToSize(
  "This manual describes the Journey tab as implemented. When the tab changes, change " +
    "scripts/docs/build-venture-manager-journey-manual.mjs with it and regenerate the PDF, so the " +
    "screen and the page never disagree.",
  CONTENT_W,
);
for (const line of closing) {
  ensure(12);
  doc.text(line, M, y);
  y += 12;
}

// ── Footers and page numbers ───────────────────────────────────────────────
const total = doc.internal.getNumberOfPages();
for (let page = 2; page <= total; page += 1) {
  doc.setPage(page);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  ink(FAINT);
  doc.text("ImpactOS · Ventures - Journey Dashboard manual for Venture Managers", M, PAGE_H - 22);
  doc.text(`${page} / ${total}`, PAGE_W - M, PAGE_H - 22, { align: "right" });
}

const bytes = Buffer.from(doc.output("arraybuffer"));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, bytes);

console.log(`Wrote ${OUT}`);
console.log(`${total} pages, ${(bytes.length / 1024).toFixed(1)} KB`);
