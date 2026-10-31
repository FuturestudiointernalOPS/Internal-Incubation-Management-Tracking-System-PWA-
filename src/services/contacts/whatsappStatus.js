/**
 * Contact rows + WhatsApp readiness (the read-side enrichment).
 *
 * A screen must not decide by itself whether a person can be messaged. The
 * registry and the CRM dossier both call this, so they always agree: the same
 * consent, the same number validation, the same reason when it is refused.
 *
 * The derived `whatsapp` object is what the UI reads:
 *   { opted_in, allowed, reason, number }
 * `number` is E.164 only when `allowed` is true.
 *
 * Reads go through `@/models/contacts`; nothing here runs SQL.
 */

import { getWhatsappConsentsForCids } from "@/models/contacts/whatsapp";
import {
  evaluateWhatsappReachability,
  isWhatsappOptedIn,
} from "@/lib/integrations/whatsapp/rules";

/** Merge each contact with its consent and the resulting reachability. */
export async function attachWhatsappStatus(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return Array.isArray(rows) ? rows : [];

  const cids = [...new Set(rows.map((row) => row?.cid).filter(Boolean))];
  let byCid = new Map();

  if (cids.length > 0) {
    try {
      const result = await getWhatsappConsentsForCids(cids);
      byCid = new Map((result.rows || []).map((row) => [row.contact_cid, row]));
    } catch (_) {
      // The consent table may not exist in an older environment yet. A missing
      // consent is "not opted in", never an implicit yes.
      byCid = new Map();
    }
  }

  return rows.map((row) => {
    const consent = byCid.get(row.cid) || null;
    const merged = {
      ...row,
      whatsapp_opt_in: isWhatsappOptedIn({ whatsapp_opt_in: consent?.opt_in }),
      whatsapp_opted_in_at: consent?.opted_in_at || null,
      whatsapp_consent_source: consent?.source || null,
    };

    const reach = evaluateWhatsappReachability(merged);

    return {
      ...merged,
      whatsapp: {
        opted_in: merged.whatsapp_opt_in,
        allowed: reach.allowed,
        reason: reach.reason,
        number: reach.allowed ? reach.phone.e164 : null,
      },
    };
  });
}
