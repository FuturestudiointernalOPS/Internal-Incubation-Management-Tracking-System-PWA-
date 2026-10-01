-- =============================================================================
-- IMPACTOS LMS — RETIRER LE NOM PUBLIC DU COURS (slug)
-- -----------------------------------------------------------------------------
-- Le catalogue public des cours, la fiche d'un cours et l'inscription en
-- libre-service aux cours gratuits qui les accompagnaient étaient adressés par
-- ce « slug ». Aucun lien ne menait à eux et le site ne s'en servait pas : ils
-- ont été retirés, et la colonne avec eux.
--
-- Un cours est désormais identifié par son TITRE — c'est exactement ce que
-- recherche le site pour trouver le formulaire qui le vend
-- (voir src/models/lms/courseMatch.js).
--
-- Idempotent : DROP COLUMN IF EXISTS — ré-exécutable sans risque.
-- À appliquer via l'éditeur SQL Supabase (production : branche main ; staging : dev).
-- =============================================================================

BEGIN;

ALTER TABLE lms_courses DROP COLUMN IF EXISTS slug;

COMMIT;
