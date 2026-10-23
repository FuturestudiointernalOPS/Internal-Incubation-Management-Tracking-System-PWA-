import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import mammoth from "mammoth";
import { readSheet } from "read-excel-file/node";
import { loadDataRoomDocument } from "@/services/ventures/dataRoom";

/**
 * GET /api/ventures/[id]/data-room/[docId]/file[?version=N]
 *
 * The document's bytes, served INLINE so the browser shows the file in its own
 * tab instead of saving it. The storage's signed URL leaves the type to whatever
 * was stored (often octet-stream, which browsers download); this route states
 * the type from the file name and never sends an attachment disposition.
 *
 * Access is the document read's own: the Venture gate and an investor's grant
 * apply exactly as they do to the catalogue, so a file cannot be reached here
 * that the catalogue would not have listed.
 */
const TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  csv: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const NOTICE = {
  fr: { text: "Ce type de fichier ne peut pas être affiché par le navigateur.", button: "Télécharger le fichier" },
  en: { text: "This file type cannot be displayed by the browser.", button: "Download the file" },
};

/** A page, not a download, for a file the browser cannot render itself. */
function noticePage({ fileName, downloadHref, language }) {
  const copy = NOTICE[language] || NOTICE.en;
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(fileName)}</title><style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f5f5f5;color:#222}main{text-align:center;padding:24px}a{display:inline-block;margin-top:16px;padding:8px 16px;border-radius:8px;background:#222;color:#fff;text-decoration:none}</style></head><body><main><h1 style="font-size:16px">${escapeHtml(fileName)}</h1><p style="font-size:13px">${copy.text}</p><a href="${escapeHtml(downloadHref)}">${copy.button}</a></main></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox" },
  });
}

const PAGE_STYLE =
  "<style>body{font-family:system-ui,sans-serif;font-size:14px;color:#222;max-width:900px;margin:0 auto;padding:24px;line-height:1.6}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;vertical-align:top}img{max-width:100%}</style>";

/**
 * Word and Excel files cannot be shown by a browser, so they are turned into a
 * static page here and opened like any other document. The page carries no
 * scripts (sandboxed below); it is only what the file said.
 */
async function renderOfficePage({ extension, buffer, fileName }) {
  let body;
  if (extension === "docx") {
    body = (await mammoth.convertToHtml({ buffer })).value;
  } else {
    const grid = await readSheet(buffer, 1, { trim: false });
    const rows = (grid || []).map(
      (row) => `<tr>${(row || []).map((cell) => `<td>${escapeHtml(cell instanceof Date ? cell.toISOString().slice(0, 10) : cell ?? "")}</td>`).join("")}</tr>`,
    );
    body = `<table>${rows.join("")}</table>`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(fileName)}</title>${PAGE_STYLE}</head><body>${body}</body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox" },
  });
}

const extensionOf = (name) => {
  const value = String(name || "").toLowerCase();
  return value.includes(".") ? value.split(".").pop() : "";
};

export const GET = createHandler(async (req, { params }) => {
  const { id, docId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  const result = await loadDataRoomDocument({ ventureId: id, documentId: docId, session });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status || 404 });
  }

  const wanted = new URL(req.url).searchParams.get("version");
  const source = wanted
    ? (result.document?.versions || []).find((version) => String(version.version_number) === String(wanted))
    : result.document;
  const signed = source?.file_url_signed;
  if (!signed) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  // An external link is not ours to stream: send the browser to it.
  if (!signed.includes("/storage/v1/")) return NextResponse.redirect(signed);

  const upstream = await fetch(signed);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  const fileName = source.file_name || result.document?.file_name || "document";
  const searchParams = new URL(req.url).searchParams;
  const asDownload = searchParams.get("download") === "1";
  const known = TYPES[extensionOf(fileName)];

  const extension = extensionOf(fileName);
  if (!known && !asDownload && (extension === "docx" || extension === "xlsx")) {
    try {
      return await renderOfficePage({ extension, buffer: Buffer.from(await upstream.arrayBuffer()), fileName });
    } catch (_) {
      // An unreadable file falls through to the notice page below.
    }
  }

  // Opening never saves a file. What the browser cannot show gets a page that
  // says so; the download is a separate, explicit click on that page.
  if (!known && !asDownload) {
    const language = String(req.headers.get("accept-language") || "").toLowerCase().startsWith("fr") ? "fr" : "en";
    const query = new URLSearchParams(searchParams);
    query.set("download", "1");
    return noticePage({ fileName, downloadHref: `?${query.toString()}`, language });
  }

  const type = known || upstream.headers.get("content-type") || "application/octet-stream";
  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // A stored file never runs scripts in this origin (an SVG can carry them).
      "Content-Security-Policy": "sandbox",
    },
  });
});
