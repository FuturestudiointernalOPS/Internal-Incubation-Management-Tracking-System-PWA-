-- ============================================================================
-- PHASE 10 — VENTURE MANAGER: one name for one responsibility
--
-- The responsibility code was `lead_manager` while the profile that every
-- assignment grants is the "Venture Manager" template, so the same person had
-- two names in the product. This renames the stored code to `venture_manager`.
--
-- DATA ONLY — no schema change. Additive in effect: nothing is deleted, the
-- rows keep their ids, and every matrix cell and every assignment keeps its
-- meaning. One statement per line (the house runner contract).
--
-- ORDER MATTERS: run this in the SAME window as the deploy. The application
-- queries `responsibility_code = 'venture_manager'`; between the two, a Venture
-- Manager simply sees nothing (fail-closed, never over-granted).
--
-- Verify afterwards (expect: 3 / 0 / 142 / 0):
--   SELECT code FROM venture_responsibilities ORDER BY code;
--   SELECT count(*) FROM venture_responsibilities WHERE code = 'lead_manager';
--   SELECT count(*) FROM venture_permission_matrix WHERE responsibility_code = 'venture_manager';
--   SELECT count(*) FROM venture_permission_matrix WHERE responsibility_code = 'lead_manager';
-- ============================================================================

UPDATE venture_responsibilities SET code = 'venture_manager', name = 'Venture Manager' WHERE code = 'lead_manager';
UPDATE venture_permission_matrix SET responsibility_code = 'venture_manager' WHERE responsibility_code = 'lead_manager';
UPDATE venture_staff_assignments SET responsibility_code = 'venture_manager' WHERE responsibility_code = 'lead_manager';
