import {
  getActiveLegalDocument,
  markInvestorNdaAccepted,
  recordLegalAcceptance,
} from "@/models/investor/legalDocuments";
import { getInvestorProfileIdByUserId } from "@/models/investor/diligenceAndPipeline/pipeline";
import { emitInvestorEvent } from "@/services/investor/activity";
import { readInvestorFlags } from "@/services/investor/featureFlags";

export async function getNdaForInvestor({ language = "en" }) {
  const flags = await readInvestorFlags();
  if (!flags.nda) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }
  const nda = (await getActiveLegalDocument({ docType: "nda", language })).rows?.[0];
  const terms = (await getActiveLegalDocument({ docType: "terms", language })).rows?.[0];
  if (!nda) return { ok: false, status: 404, error: "errors.notFound" };
  return {
    ok: true,
    nda: {
      id: nda.id,
      version: nda.version,
      language: nda.language,
      title: nda.title,
      body_md: nda.body_md,
      status: nda.status,
    },
    terms: terms
      ? {
          id: terms.id,
          version: terms.version,
          language: terms.language,
          title: terms.title,
          body_md: terms.body_md,
          status: terms.status,
        }
      : null,
  };
}

export async function acceptNda({ session, language = "en", version }) {
  const flags = await readInvestorFlags();
  if (!flags.nda) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }
  const cid = session?.cid || session?.id;
  if (!cid) return { ok: false, status: 401, error: "errors.unauthorized" };

  const profile = (await getInvestorProfileIdByUserId(cid)).rows?.[0];
  if (!profile?.id) return { ok: false, status: 404, error: "errors.notFound" };

  const nda = (await getActiveLegalDocument({ docType: "nda", language })).rows?.[0];
  if (!nda) return { ok: false, status: 404, error: "errors.notFound" };
  if (version && version !== nda.version) {
    return { ok: false, status: 409, error: "errors.invalidRequest" };
  }

  await recordLegalAcceptance({
    investorProfileId: profile.id,
    documentId: nda.id,
    docType: "nda",
    version: nda.version,
    language: nda.language,
  });

  const terms = (await getActiveLegalDocument({ docType: "terms", language })).rows?.[0];
  if (terms) {
    await recordLegalAcceptance({
      investorProfileId: profile.id,
      documentId: terms.id,
      docType: "terms",
      version: terms.version,
      language: terms.language,
    });
  }

  const updated = await markInvestorNdaAccepted({
    investorProfileId: profile.id,
    version: nda.version,
  });

  await emitInvestorEvent({
    session,
    investorId: profile.id,
    eventType: "terms_accepted",
    metadata: {
      nda_version: nda.version,
      nda_language: nda.language,
      nda_status: nda.status,
      terms_version: terms?.version || null,
    },
  });

  return { ok: true, profile: updated.rows?.[0] || null, version: nda.version };
}
