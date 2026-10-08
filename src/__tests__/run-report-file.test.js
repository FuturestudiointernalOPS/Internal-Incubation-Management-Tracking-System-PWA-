/**
 * RUN REPORT FILE — what may be attached, and what is stored.
 *
 * A Run's final report is shaped by two things the administrator can supply: the
 * Output Instruction (typed) and one attached document (uploaded). This suite
 * keeps the rules that make the second one safe, and that are easy to lose:
 *
 *   1. Only formats the writer can actually READ are accepted — a document that
 *      cannot be read must never look like it took part.
 *   2. The document is read into TEXT before it is stored, and the outcome
 *      (ok / empty / failed) travels with it, so a scanned PDF is LABELLED rather
 *      than quietly ignored.
 *   3. One document per Run, replaced in place, and removing it hands the object
 *      path back.
 *   4. The storage path never reaches a browser — only a short-lived link does.
 *
 * The report composition and the wiring pins live in
 * run-report-file.compose.test.js.
 */

const mockReport = require("./helpers/runReportFileHarness");

jest.mock("@/lib/db", () => mockReport.dbMock());
jest.mock("@/lib/deepseek", () => mockReport.deepseekMock());

beforeEach(() => {
  mockReport.reset();
});

const {
  storedFiles,
  executed,
  fileLike,
  textFile,
  docxFile,
  pdfBytes,
  pdfFile,
} = mockReport;

const {
  validateRunReportFile,
  isManagedRunReportFilePath,
  MAX_RUN_REPORT_FILE_BYTES,
} = require("@/lib/platform/runReportFiles");
const {
  extractReportFileText,
  reportFileKind,
  wordXmlToText,
  cleanExtractedText,
  MAX_RUN_REPORT_FILE_TEXT,
} = require("@/lib/platform/runReportFileText");
const {
  getRunReportFileByRunId,
  getRunReportFileTextByRunId,
  upsertRunReportFile,
  deleteRunReportFileByRunId,
  runReportFileDescriptor,
} = require("@/models/platform/reportFiles");

// ─── 1. What may be attached at all ─────────────────────────────────────────

describe("the attached document is validated before anything is stored", () => {
  test("the formats the writer can read are accepted", () => {
    expect(validateRunReportFile(textFile()).success).toBe(true);
    expect(validateRunReportFile(docxFile("<w:document/>")).success).toBe(true);
    expect(validateRunReportFile(fileLike("notes.md", "", [1, 2, 3])).success).toBe(true);
    // Type is enough on its own: a browser that does not know the name still
    // reports the type for a real PDF.
    expect(validateRunReportFile(fileLike("scan", "application/pdf", [1])).success).toBe(true);
  });

  test("the old Word format is refused with its own message, not a generic one", () => {
    const result = validateRunReportFile(fileLike("rubric.doc", "application/msword", [1]));
    expect(result.success).toBe(false);
    expect(result.error).toBe("platformMisc.runs.reportFileLegacyDoc");
  });

  test("a format with no reader is refused", () => {
    expect(validateRunReportFile(fileLike("chart.png", "image/png", [1])).error).toBe(
      "platformMisc.runs.reportFileTypeInvalid",
    );
    expect(validateRunReportFile(null).error).toBe("platformMisc.runs.reportFileRequired");
    expect(validateRunReportFile("rubric.txt").error).toBe("platformMisc.runs.reportFileRequired");
  });

  test("the size ceiling is enforced here, before a byte is written", () => {
    const big = {
      name: "huge.txt",
      type: "text/plain",
      size: MAX_RUN_REPORT_FILE_BYTES + 1,
      arrayBuffer: async () => new ArrayBuffer(0),
    };
    expect(validateRunReportFile(big).error).toBe("platformMisc.runs.reportFileTooLarge");
  });

  test("only objects under this domain's own prefix may be signed or deleted", () => {
    expect(isManagedRunReportFilePath("runs/12/1234-rubric.pdf")).toBe(true);
    expect(isManagedRunReportFilePath("deliverables/VNT-1/evidence.pdf")).toBe(false);
    expect(isManagedRunReportFilePath("runs/../../secrets.pdf")).toBe(false);
  });
});

// ─── 2. Reading a document into text ────────────────────────────────────────

describe("the document is read into text, and the outcome is honest", () => {
  test("the reader is chosen by name first, then by type", () => {
    expect(reportFileKind({ name: "a.pdf" })).toBe("pdf");
    expect(reportFileKind({ name: "a", mime: "application/pdf" })).toBe("pdf");
    expect(reportFileKind({ name: "a.docx" })).toBe("docx");
    expect(reportFileKind({ name: "a.markdown" })).toBe("text");
    expect(reportFileKind({ name: "a.docx", mime: "application/octet-stream" })).toBe("docx");
    expect(reportFileKind({ name: "a.png", mime: "image/png" })).toBe(null);
  });

  test("a text document is read and cleaned", async () => {
    const outcome = await extractReportFileText(
      textFile("rubric.txt", "Line one   \r\n\r\n\r\n\r\nLine two\u0000 end"),
    );
    expect(outcome.status).toBe("ok");
    expect(outcome.text).toBe("Line one\n\nLine two end");
  });

  test("a Word document keeps its paragraphs and drops what Word hid", async () => {
    const xml = `<?xml version="1.0"?><w:document><w:body>
      <w:p><w:r><w:t>Traction &amp; team</w:t></w:r></w:p>
      <w:p><w:r><w:t>1.</w:t><w:tab/><w:t>Score out of 5</w:t></w:r></w:p>
      <w:p><w:del><w:r><w:delText>REMOVED DRAFT WORDING</w:delText></w:r></w:del><w:r><w:t>Final wording</w:t></w:r></w:p>
    </w:body></w:document>`;
    const outcome = await extractReportFileText(docxFile(xml));

    expect(outcome.status).toBe("ok");
    expect(outcome.text).toContain("Traction & team");
    expect(outcome.text).toContain("1.\tScore out of 5");
    expect(outcome.text).toContain("Final wording");
    // A tracked deletion is not content the writer may report on.
    expect(outcome.text).not.toContain("REMOVED DRAFT WORDING");
  });

  test("a PDF is read through the engine, and an empty one says so", async () => {
    // The engine is injected here: it is a dynamic ES module, which the test
    // runner's sandbox refuses to load (see the engine test below).
    const readPdf = jest.fn(async () => "ImpactOS evaluation rubric");
    const outcome = await extractReportFileText(pdfFile(), { readPdf });

    expect(outcome.status).toBe("ok");
    expect(outcome.text).toBe("ImpactOS evaluation rubric");
    // The engine receives BYTES, not the browser's File object.
    expect(Buffer.isBuffer(readPdf.mock.calls[0][0])).toBe(true);

    const empty = await extractReportFileText(pdfFile(), { readPdf: async () => "" });
    expect(empty.status).toBe("empty");
    expect(empty.text).toBe("");
    expect(empty.error).toBeTruthy();
  });

  test("the production PDF engine really reads a text layer here", () => {
    const { execFileSync } = require("child_process");
    // Outside the sandbox, because the engine cannot be imported inside it: this
    // is the check that a PDF attached to a run is not silently unreadable.
    const script = [
      'import { extractText, getDocumentProxy } from "unpdf";',
      'const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(process.env.PDF_B64, "base64")));',
      'const { text } = await extractText(pdf, { mergePages: true });',
      'process.stdout.write(String(text || ""));',
    ].join("\n");

    const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, PDF_B64: pdfBytes(["ImpactOS evaluation rubric"]).toString("base64") },
      encoding: "utf8",
    });

    expect(output).toContain("ImpactOS evaluation rubric");
  }, 60000);

  test("a corrupt document fails without throwing, keeping the file usable by a human", async () => {
    // The failure path logs on purpose; keep the runner output readable.
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const broken = fileLike("broken.docx", "application/octet-stream", [1, 2, 3, 4]);
    const outcome = await extractReportFileText(broken);
    errorSpy.mockRestore();

    expect(outcome.status).toBe("failed");
    expect(outcome.text).toBe("");
    expect(outcome.error).toBeTruthy();
  });

  test("what is kept is bounded, and the cut is reported", async () => {
    const long = "a".repeat(MAX_RUN_REPORT_FILE_TEXT + 500);
    const outcome = await extractReportFileText(textFile("long.txt", long));
    expect(outcome.status).toBe("ok");
    expect(outcome.truncated).toBe(true);
    expect(outcome.text.length).toBe(MAX_RUN_REPORT_FILE_TEXT);
  });

  test("the Word reader and the cleaner are predictable in isolation", () => {
    expect(wordXmlToText("<w:p><w:r><w:t>&#233;t&#233;</w:t></w:r></w:p>")).toContain("été");
    expect(cleanExtractedText("  a  \n\n\n\n  b  ")).toBe("a\n\nb");
  });
});

// ─── 3. Storage of the document row ─────────────────────────────────────────

describe("one document per run, replaced in place", () => {
  test("re-attaching replaces the row instead of accumulating", async () => {
    await upsertRunReportFile({
      runId: 12,
      fileName: "first.txt",
      storagePath: "runs/12/1-first.txt",
      extractedText: "first",
      extractionStatus: "ok",
    });
    const second = await upsertRunReportFile({
      runId: 12,
      fileName: "second.txt",
      storagePath: "runs/12/2-second.txt",
      extractedText: "second",
      extractionStatus: "ok",
    });

    expect(storedFiles).toHaveLength(1);
    expect(second.file_name).toBe("second.txt");
    expect(storedFiles[0].storage_path).toBe("runs/12/2-second.txt");
    // The replacement is expressed in SQL too, so a concurrent upload cannot
    // create a second row.
    const upsert = executed.find((query) => /INSERT INTO platform_run_report_files/.test(query.text));
    expect(upsert.text).toMatch(/ON CONFLICT \(run_id\) DO UPDATE/);
  });

  test("reading the text is a separate, small question", async () => {
    await upsertRunReportFile({
      runId: 12,
      fileName: "rubric.docx",
      storagePath: "runs/12/1-rubric.docx",
      extractedText: "Score traction out of 5.",
      extractionStatus: "ok",
    });

    const text = await getRunReportFileTextByRunId(12);
    expect(text).toEqual({
      fileName: "rubric.docx",
      status: "ok",
      text: "Score traction out of 5.",
    });
    expect(await getRunReportFileTextByRunId(99)).toBe(null);
  });

  test("removing hands back the object path, and only for this run", async () => {
    await upsertRunReportFile({
      runId: 12,
      fileName: "rubric.txt",
      storagePath: "runs/12/1-rubric.txt",
      extractedText: "x",
      extractionStatus: "ok",
    });

    expect(await deleteRunReportFileByRunId(12)).toBe("runs/12/1-rubric.txt");
    expect(await deleteRunReportFileByRunId(12)).toBe(null); // idempotent
    expect(storedFiles).toHaveLength(0);
  });

  test("the descriptor carries what a screen needs and never the storage path", async () => {
    await upsertRunReportFile({
      runId: 12,
      fileName: "rubric.txt",
      mimeType: "text/plain",
      fileSize: 2048,
      storagePath: "runs/12/1-rubric.txt",
      extractedText: "Score traction out of 5.",
      extractionStatus: "ok",
      uploadedBy: "USR-1",
    });

    const row = await getRunReportFileByRunId(12);
    const descriptor = runReportFileDescriptor(row, "https://supabase.test/sign/x");

    expect(descriptor.file_name).toBe("rubric.txt");
    expect(descriptor.text_length).toBe("Score traction out of 5.".length);
    expect(descriptor.url).toBe("https://supabase.test/sign/x");
    expect(descriptor.storage_path).toBeUndefined();
    expect(JSON.stringify(descriptor)).not.toContain("runs/12/1-rubric.txt");
    expect(runReportFileDescriptor(null)).toBe(null);
  });
});
