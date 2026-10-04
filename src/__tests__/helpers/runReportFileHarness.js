/**
 * Shared wiring for the Run report FILE tests.
 *
 * The document table and the report store are kept as real rows, so "one per
 * Run, replaced in place" and "removing hands back the object path" stay
 * behaviour under test instead of assertions about a SQL string. Both stores
 * therefore belong to THIS module — and because Jest's registry is per test
 * file, each suite that requires this helper gets its own.
 *
 * The stores are cleared IN PLACE rather than reassigned: a suite destructures
 * them once at the top, and a reassignment would leave that copy pointing at the
 * array from before the reset. For the same reason a test that wants to seed a
 * stored report goes through `setStoredReports()` instead of assigning.
 *
 * The db and the deepseek chat are factories, because the harness owns the
 * state they read. Register them as
 * `jest.mock("@/lib/db", () => mockReport.dbMock())`.
 */

const fs = require("fs");
const path = require("path");
const { zipSync, strToU8 } = require("fflate");
const { readSurface } = require("./sourceSurface");

const read = (rel) => {
  const text = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  // Slice 1: the review/email/result-document cluster moved from the route to
  // the service — append it so assertions against either half still match. The
  // service is itself split across `formRuns/`, so read its whole surface.
  if (rel === "src/app/api/platform/form-runs/route.js") {
    // Searched first: a same-named call left in the route (e.g. a standalone
    // resend action) must never be found before the one inside the moved
    // service function that an order assertion is pinning.
    return readSurface("src/services/platform/formRuns.js") + "\n" + text;
  }
  if (rel === "src/services/platform/formRuns.js") return readSurface(rel);
  // V2: the run screen is split — the page keeps the state, the writes live in
  // its own `actions/` and the JSX in components/platform/runs/. Read all three
  // so a pin cannot go vacuously green when the code moves out again.
  if (rel === "src/app/platform/runs/page.js") {
    return readSurface("src/app/platform/runs", "src/components/platform/runs");
  }
  return text;
};

const REPORT_FILE_ROUTE = "src/app/api/platform/form-runs/report-file/route.js";
const FORM_RUNS_DETAIL_SERVICE = "src/services/platform/formRuns.js";
const RUNS_PAGE = "src/app/platform/runs/page.js";

const storedReports = [];
const insertedReports = [];
const storedFiles = [];
const executed = [];

const mockChat = jest.fn();

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
      const text = String(sql);
      executed.push({ text, args });

      if (/FROM platform_submission_reports/.test(text)) {
        // Keyed exactly, like the real query: a stored report is only returned when
        // the CURRENT key matches it.
        return { rows: storedReports.filter((report) => report.instruction_hash === args[1]) };
      }
      if (/INSERT INTO platform_submission_reports/.test(text)) {
        insertedReports.push({ text, args });
        return { rows: [{ id: 1, generated_at: "2026-09-21T00:00:00Z" }] };
      }

      if (/INSERT INTO platform_run_report_files/.test(text)) {
        const [runId, fileName, mimeType, fileSize, storagePath, extractedText, status, error, uploadedBy] = args;
        const existing = storedFiles.find((file) => Number(file.run_id) === Number(runId));
        const row = {
          id: existing?.id ?? storedFiles.length + 1,
          run_id: Number(runId),
          file_name: fileName,
          mime_type: mimeType,
          file_size: fileSize,
          storage_path: storagePath,
          extracted_text: extractedText,
          extraction_status: status,
          extraction_error: error,
          uploaded_by: uploadedBy,
          uploaded_at: "2026-09-21T00:00:00Z",
          text_length: (extractedText || "").length,
        };
        if (existing) Object.assign(existing, row);
        else storedFiles.push(row);
        return { rows: [row] };
      }
      if (/DELETE FROM platform_run_report_files/.test(text)) {
        const index = storedFiles.findIndex((file) => Number(file.run_id) === Number(args[0]));
        if (index === -1) return { rows: [] };
        const [removed] = storedFiles.splice(index, 1);
        return { rows: [{ storage_path: removed.storage_path }] };
      }
      if (/FROM platform_run_report_files/.test(text)) {
        const row = storedFiles.find((file) => Number(file.run_id) === Number(args[0]));
        return { rows: row ? [row] : [] };
      }
  }),
};

function dbMock() {
  return {
    __esModule: true,
    default: mockDb,
    initDb: jest.fn(async () => true),
  };
}

function deepseekMock() {
  return {
    deepseekIntelligence: { chat: (...args) => mockChat(...args) },
    default: { chat: (...args) => mockChat(...args) },
  };
}

/** A browser File is a name, a type, a size and its bytes. */
const fileLike = (name, type, bytes) => {
  const data = Uint8Array.from(bytes);
  return { name, type, size: data.length, arrayBuffer: async () => data.buffer };
};

const textFile = (name = "rubric.txt", content = "Score traction out of 5.") =>
  fileLike(name, "text/plain", Buffer.from(content, "utf8"));

/** A minimal .docx: a zip whose word/document.xml carries the paragraphs. */
const docxFile = (documentXml, name = "rubric.docx") =>
  fileLike(
    name,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    zipSync({ "word/document.xml": strToU8(documentXml) }),
  );

/** Bytes of a real PDF with a text layer, from the project's own PDF writer. */
const pdfBytes = (lines = ["ImpactOS evaluation rubric"]) => {
  const { jsPDF } = require("jspdf");
  const pdfDocument = new jsPDF();
  lines.forEach((line, lineIndex) => pdfDocument.text(line, 10, 20 + lineIndex * 10));
  return Buffer.from(pdfDocument.output("arraybuffer"));
};

const pdfFile = (lines, name = "rubric.pdf") => fileLike(name, "application/pdf", pdfBytes(lines));

/** The whole beforeEach: both stores, the query log, and the chat answer. */
/**
 * Seed a stored report. The db mock reads the module binding, so a test that
 * wants a different report row goes through this rather than reassigning.
 */
function setStoredReports(rows) {
  storedReports.length = 0;
  storedReports.push(...rows);
}

function reset() {
  storedReports.length = 0;
  insertedReports.length = 0;
  storedFiles.length = 0;
  executed.length = 0;
  mockDb.execute.mockClear();
  mockChat.mockReset();
}

module.exports = {
  read,
  REPORT_FILE_ROUTE,
  FORM_RUNS_DETAIL_SERVICE,
  RUNS_PAGE,
  storedReports,
  setStoredReports,
  mockChat,
  insertedReports,
  storedFiles,
  executed,
  mockDb,
  dbMock,
  deepseekMock,
  fileLike,
  textFile,
  docxFile,
  pdfBytes,
  pdfFile,
  reset,
};
