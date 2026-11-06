-- Investor NDA / Terms: versioned bilingual documents + acceptances (Guide §13.4, A.10).
-- Additive only. Seed text is DRAFT for studio legal review — not counsel-approved.
BEGIN;

CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('terms', 'nda')),
  version TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'fr')),
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  effective_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doc_type, version, language)
);

CREATE TABLE IF NOT EXISTS investor_legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES legal_documents(id),
  doc_type TEXT NOT NULL,
  version TEXT NOT NULL,
  language TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (investor_profile_id, doc_type, version)
);

CREATE INDEX IF NOT EXISTS idx_investor_legal_acceptances_profile
  ON investor_legal_acceptances (investor_profile_id);

ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS nda_accepted_at TIMESTAMPTZ;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS nda_version TEXT;

INSERT INTO legal_documents (doc_type, version, language, title, body_md, status, effective_at)
VALUES
(
  'nda',
  'DRAFT-2026-11-06',
  'en',
  'Investor Non-Disclosure Agreement (DRAFT)',
  $en_nda$
# Investor Non-Disclosure Agreement — DRAFT

**Status:** Draft for Future Studio legal review. This text is **not** approved counsel language and must be replaced before production release.

**Parties.** Future Studio ("Studio") and the approved investor ("Investor").

**1. Purpose.** The Investor may receive confidential information about Studio ventures, fundraising processes, and introductions solely to evaluate potential investment.

**2. Confidential information.** Includes pitch materials, financial information shared by the Studio, introduction outcomes, and non-public product or market data. Public information is excluded.

**3. Obligations.** The Investor will not disclose confidential information to third parties without Studio written consent, except to professional advisors under equivalent confidentiality, or as required by law (with notice where lawful).

**4. Use.** Information may be used only to evaluate investment opportunities presented by the Studio.

**5. Duration.** Obligations continue for three (3) years after acceptance, or longer if required by a specific venture agreement.

**6. No licence.** Nothing grants IP rights in Studio or venture materials.

**7. Return / destruction.** On request, the Investor will destroy or return confidential materials, except copies retained under legal hold.

**8. Acceptance.** Electronic acceptance records the Investor identity, document version, language, and timestamp.

Replace this draft with studio-counsel-approved English text before marking `status = approved`.
$en_nda$,
  'draft',
  NOW()
),
(
  'nda',
  'DRAFT-2026-11-06',
  'fr',
  'Accord de confidentialité investisseur (BROUILLON)',
  $fr_nda$
# Accord de confidentialité investisseur — BROUILLON

**Statut :** Brouillon pour relecture juridique Future Studio. Ce texte **n’est pas** un avis juridique approuvé et doit être remplacé avant une mise en production.

**Parties.** Future Studio (« Studio ») et l’investisseur approuvé (« Investisseur »).

**1. Objet.** L’Investisseur peut recevoir des informations confidentielles sur les ventures du Studio, les levées de fonds et les introductions, uniquement pour évaluer un investissement potentiel.

**2. Informations confidentielles.** Incluent les pitchs, les informations financières partagées par le Studio, les décisions d’introduction et les données non publiques. Les informations publiques sont exclues.

**3. Obligations.** L’Investisseur ne divulgue pas ces informations à des tiers sans accord écrit du Studio, sauf à des conseils professionnels tenus à une confidentialité équivalente, ou si la loi l’exige (avec notification lorsque c’est permis).

**4. Usage.** Les informations ne servent qu’à évaluer les opportunités présentées par le Studio.

**5. Durée.** Les obligations durent trois (3) ans après l’acceptation, ou plus longtemps si un accord venture le prévoit.

**6. Absence de licence.** Aucun droit de propriété intellectuelle n’est concédé sur les contenus du Studio ou des ventures.

**7. Restitution.** Sur demande, l’Investisseur détruit ou restitue les supports confidentiels, sauf conservation imposée par la loi.

**8. Acceptation.** L’acceptation électronique enregistre l’identité, la version, la langue et l’horodatage.

Remplacer ce brouillon par un texte français validé par le conseil du Studio avant `status = approved`.
$fr_nda$,
  'draft',
  NOW()
),
(
  'terms',
  'DRAFT-2026-11-06',
  'en',
  'Investor Terms of Use (DRAFT)',
  $en_terms$
# Investor Terms of Use — DRAFT

**Status:** Draft for Future Studio legal review. Not counsel-approved.

By using Investor OS the Investor agrees to use the platform for legitimate investment evaluation, to keep credentials secure, and to follow Studio introduction and messaging rules. The Studio may suspend access for misuse. These terms are separate from the NDA.

Replace with counsel-approved English terms before production.
$en_terms$,
  'draft',
  NOW()
),
(
  'terms',
  'DRAFT-2026-11-06',
  'fr',
  'Conditions d’utilisation investisseur (BROUILLON)',
  $fr_terms$
# Conditions d’utilisation investisseur — BROUILLON

**Statut :** Brouillon pour relecture juridique Future Studio. Non approuvé par un conseil.

En utilisant Investor OS, l’Investisseur s’engage à une évaluation légitime d’investissements, à protéger ses identifiants et à respecter les règles d’introduction et de messagerie du Studio. Le Studio peut suspendre l’accès en cas d’abus. Ces conditions sont distinctes de l’accord de confidentialité.

Remplacer par des conditions françaises validées avant la production.
$fr_terms$,
  'draft',
  NOW()
)
ON CONFLICT (doc_type, version, language) DO UPDATE
SET title = EXCLUDED.title,
    body_md = EXCLUDED.body_md,
    status = EXCLUDED.status,
    effective_at = EXCLUDED.effective_at;

-- Enable NDA gate on staging for draft acceptance testing.
-- Documents remain status=draft until counsel marks them approved.
UPDATE feature_flags
SET is_enabled = TRUE,
    updated_at = NOW()
WHERE flag_key = 'investor_nda_v1'
  AND is_enabled IS DISTINCT FROM TRUE;

COMMIT;
