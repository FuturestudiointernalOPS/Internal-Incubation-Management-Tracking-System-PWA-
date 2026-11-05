import {
  runInTransaction,
  selectCurrentProfile,
  selectProfileHistory,
  selectNextProfileVersion,
  supersedeCurrentProfile,
  insertProfileVersion,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema } from "./settings";
import { validateStaticProfile, textOrNull, dateOrNull } from "./rules";

/**
 * The static profile is append-only: every save creates a new version and
 * supersedes the previous one. Nothing is ever updated in place.
 */

const shape = (row) =>
  row
    ? {
        id: row.id,
        ventureUuid: row.venture_uuid,
        ventureCode: row.venture_code,
        version: row.version,
        effectiveFrom: row.effective_from,
        isCurrent: row.is_current,
        legalName: row.legal_name,
        tradeName: row.trade_name,
        foundingDate: row.founding_date,
        registrationStatus: row.registration_status,
        registrationCountry: row.registration_country,
        paysTaxes: row.pays_taxes,
        socialProtection: row.social_protection,
        sector: row.sector,
        businessModel: row.business_model,
        problemStatement: row.problem_statement,
        idealCustomerProfile: row.ideal_customer_profile,
        countriesOfOperation: row.countries_of_operation || [],
        northStarName: row.north_star_name,
        northStarDefinition: row.north_star_definition,
        northStarUnit: row.north_star_unit,
        reportingCurrency: row.reporting_currency,
        accountingBasis: row.accounting_basis,
        vatIncluded: row.vat_included,
        createdAt: row.created_at,
        supersededAt: row.superseded_at,
        supersededReason: row.superseded_reason,
      }
    : null;

export async function getCurrentProfile({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectCurrentProfile(ventureUuid);
  return shape((result.rows || [])[0]);
}

export async function getProfileHistory({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectProfileHistory(ventureUuid);
  return result.rows || [];
}

/**
 * Save a new profile version.
 * Returns { profile } on success or { errors: [i18nKey] } on validation failure.
 */
export async function saveProfile({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();

  const errors = validateStaticProfile(input);
  if (errors.length) return { errors };

  const profile = await runInTransaction(async (query) => {
    const nextResult = await selectNextProfileVersion(query, ventureUuid);
    const version = Number(nextResult.rows?.[0]?.next_version || 1);
    const reason = textOrNull(input.reason) || "New version";

    if (version > 1) {
      await supersedeCurrentProfile(query, { ventureUuid, actorCid, reason });
    }

    const inserted = await insertProfileVersion(query, {
      ventureUuid,
      ventureCode,
      version,
      effectiveFrom: dateOrNull(input.effectiveFrom) || new Date().toISOString().slice(0, 10),
      legalName: textOrNull(input.legalName),
      tradeName: textOrNull(input.tradeName),
      foundingDate: dateOrNull(input.foundingDate),
      registrationStatus: textOrNull(input.registrationStatus),
      registrationCountry: textOrNull(input.registrationCountry),
      paysTaxes: input.paysTaxes === true,
      socialProtection: input.socialProtection === true,
      sector: textOrNull(input.sector),
      businessModel: textOrNull(input.businessModel),
      problemStatement: textOrNull(input.problemStatement),
      idealCustomerProfile: textOrNull(input.idealCustomerProfile),
      countriesOfOperation: Array.isArray(input.countriesOfOperation)
        ? input.countriesOfOperation.map((item) => String(item).trim()).filter(Boolean)
        : [],
      northStarName: textOrNull(input.northStarName),
      northStarDefinition: textOrNull(input.northStarDefinition),
      northStarUnit: textOrNull(input.northStarUnit),
      reportingCurrency: textOrNull(input.reportingCurrency) || "XOF",
      accountingBasis: textOrNull(input.accountingBasis),
      vatIncluded: input.vatIncluded === true,
      actorCid,
    });
    return (inserted.rows || [])[0];
  });

  return { profile: shape(profile) };
}
