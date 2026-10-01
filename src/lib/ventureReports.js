/**
 * COMPATIBILITY FACADE — the venture progress reports moved to the service.
 *
 * This module validated and shaped the reports while running their SQL inline.
 * The validation and the row → response mapping now live in
 * `@/services/ventures/reports`; every statement in
 * `@/models/ventureReportStore`.
 *
 * Re-exported unchanged so existing importers keep working (the
 * progress-reports and journey-reports routes). New code imports from the
 * service. Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

import {
  REPORT_KINDS,
  createVentureReport,
  listVentureReports,
  listJourneysMissingClosingReport,
  getVentureReport,
  updateVentureReportStatus,
  listPortfolioReports,
  listPortfolioMissingClosingReports,
} from "@/services/ventures/reports";

export {
  REPORT_KINDS,
  createVentureReport,
  listVentureReports,
  listJourneysMissingClosingReport,
  getVentureReport,
  updateVentureReportStatus,
  listPortfolioReports,
  listPortfolioMissingClosingReports,
};

export default {
  createVentureReport,
  listVentureReports,
  getVentureReport,
  updateVentureReportStatus,
  listJourneysMissingClosingReport,
  listPortfolioReports,
  listPortfolioMissingClosingReports,
  REPORT_KINDS,
};
