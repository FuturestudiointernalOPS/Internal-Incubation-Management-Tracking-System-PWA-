import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { getLearnerCertificate } from "@/lib/lms/certificates";
import { buildCertificatePdf } from "@/lib/lms/certificate-pdf";
import { lmsErrorResponse, LmsError } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/certificates/[id]/download
 * Downloads the learner's certificate as a PDF.
 *
 * The PDF is generated SERVER-SIDE from the authoritative certificate record
 * (snapshotted learner name, course title, issue date, certificate number) —
 * the browser can never supply arbitrary name/course/date/id content. The
 * request only identifies the certificate; the server loads the record and
 * enforces ownership (a learner cannot download another learner's certificate).
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;
    const certificate = await getLearnerCertificate(id, session.cid);
    if (certificate.status !== "valid") {
      throw new LmsError("lms.errors.certificateRevoked", 409);
    }

    const pdfBytes = buildCertificatePdf(certificate);
    const filename = `${certificate.certificate_number}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.byteLength),
      },
    });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
