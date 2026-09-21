/**
 * RUN REPORT FILE — reading a document into text.
 *
 * The report writer receives no file. It receives TEXT, so an attached document
 * has to be turned into text before it can shape a report — which is why this
 * module exists, and why its outcome is reported honestly instead of being
 * glossed over:
 *
 *   ok    — text was read, and the writer can use it;
 *   empty — the document was read and genuinely has no text to give (a scanned
 *           PDF is a photograph of words: nothing to extract, and no amount of
 *           retrying changes that). The file stays openable for a human;
 *   failed — extraction itself broke (corrupt file, unreadable archive).
 *
 * The extracted text is CLEANED (line endings, trailing spaces, run-away blank
 * lines) and CAPPED, because it is stored in the database and handed to a model:
 * an unbounded copy of a document is how a table grows without anyone deciding
 * to let it.
 *
 * Every format named in the accepted list is read here by its own reader; a
 * format with no reader must not be accepted upstream in the first place.
 */
import { unzipSync } from "fflate";

/**
 * How much text is KEPT from one document. Generous on purpose: instruction
 * documents are short, and this ceiling exists to bound a pathological upload,
 * not to trim a normal one. (What the report writer actually reads is capped
 * separately, in the report model.)
 */
export const MAX_RUN_REPORT_FILE_TEXT = 100_000;

/** Extraction outcomes — mirrors `RUN_REPORT_FILE_STATUSES` in the model. */
export const EXTRACTION_OK = "ok";
export const EXTRACTION_EMPTY = "empty";
export const EXTRACTION_FAILED = "failed";

/**
 * Which reader a file needs, from its name first and its type second (a browser
 * often sends an empty or generic type, while the extension is reliable).
 * Returns null for a format this module cannot read.
 */
export function reportFileKind({ name, mime } = {}) {
  const fileName = String(name || "").toLowerCase();
  const mimeType = String(mime || "").toLowerCase();

  if (/\.pdf$/.test(fileName) || mimeType === "application/pdf") return "pdf";
  if (
    /\.docx$/.test(fileName) ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (/\.(txt|md|markdown)$/.test(fileName) || mimeType.startsWith("text/")) return "text";
  return null;
}

/** Decode the XML entities Word uses, without tripping over a stray code point. */
function decodeXmlEntities(value) {
  const fromCode = (code) => {
    try {
      return String.fromCodePoint(code);
    } catch (_) {
      return "";
    }
  };
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => fromCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => fromCode(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Turn WordprocessingML into plain text.
 *
 * Only `w:t` elements carry readable text, so everything else is removed on
 * purpose: tracked deletions and field codes must NOT come back as content the
 * writer would then report on. Paragraphs and line breaks become newlines so the
 * document's structure survives as far as plain text allows.
 */
export function wordXmlToText(xml) {
  return decodeXmlEntities(
    String(xml || "")
      .replace(/<w:del\b[\s\S]*?<\/w:del>/g, "") // removed text (tracked changes)
      .replace(/<w:delText\b[\s\S]*?<\/w:delText>/g, "")
      .replace(/<w:instrText\b[\s\S]*?<\/w:instrText>/g, "") // field codes
      .replace(/<w:tab\b[^>]*\/?>/g, "\t")
      .replace(/<w:br\b[^>]*\/?>/g, "\n")
      .replace(/<\/w:(?:p|tr)>/g, "\n") // paragraph / table row
      .replace(/<\/w:tc>/g, "\t") // table cell
      .replace(/<[^>]+>/g, ""), // every remaining tag
  );
}

/** Read `word/document.xml` out of the .docx archive. */
function docxToText(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const entry = files["word/document.xml"];
  if (!entry) throw new Error("word/document.xml is missing from the .docx archive");
  return wordXmlToText(Buffer.from(entry).toString("utf8"));
}

/**
 * Read a PDF's text layer with the project's PDF engine.
 *
 * The engine is loaded on demand, so it only enters a request that actually has
 * a PDF to read.
 */
async function defaultPdfReader(buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : String(text || "");
}

/** Normalize the raw text: line endings, trailing spaces, blank-line runs. */
export function cleanExtractedText(value) {
  const NUL = "\u0000"; // written as a literal so no control-character regex is needed
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split(NUL)
    .join("")
    .split("\n")
    // Both ends of every line: extraction adds layout padding that is noise in a
    // brief, and the reader shows this text as it is.
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** One outcome, always the same shape — no caller has to guess what it got. */
function result(status, text, error, truncated = false) {
  return { status, text, error, truncated };
}

/**
 * Read one uploaded document into text.
 *
 * Never throws: a document that cannot be read comes back as a `failed` outcome
 * carrying the technical reason, so the caller stores the file, records why it
 * is unusable, and still lets a human open it.
 *
 * `readPdf` is injectable because the PDF engine is loaded as a dynamic ES
 * module, which the test runner's module sandbox refuses outright. Tests drive
 * the rest of this pipeline — buffer, cleaning, capping, statuses — through a
 * stub reader and check the production engine separately, rather than the whole
 * PDF path going untested.
 *
 * @param {File} file
 * @returns {Promise<{status: string, text: string, error: string|null, truncated: boolean}>}
 */
export async function extractReportFileText(file, { readPdf = defaultPdfReader } = {}) {
  const kind = reportFileKind({ name: file?.name, mime: file?.type });
  if (!kind) return result(EXTRACTION_FAILED, "", "unsupported document type");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const raw =
      kind === "pdf"
        ? await readPdf(buffer)
        : kind === "docx"
          ? docxToText(buffer)
          : buffer.toString("utf8");

    const text = cleanExtractedText(raw);
    if (!text) {
      return result(
        EXTRACTION_EMPTY,
        "",
        kind === "pdf"
          ? "the PDF has no text layer (likely a scan or an image export)"
          : "the document contains no text",
      );
    }

    const truncated = text.length > MAX_RUN_REPORT_FILE_TEXT;
    return result(
      EXTRACTION_OK,
      truncated ? text.slice(0, MAX_RUN_REPORT_FILE_TEXT) : text,
      null,
      truncated,
    );
  } catch (e) {
    console.error("[Run report file] extraction failed:", e?.message || e);
    return result(EXTRACTION_FAILED, "", e?.message || "extraction failed");
  }
}

export default {
  MAX_RUN_REPORT_FILE_TEXT,
  extractReportFileText,
  reportFileKind,
  wordXmlToText,
  cleanExtractedText,
};
