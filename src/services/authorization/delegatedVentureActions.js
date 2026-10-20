/**
 * DELEGATED VENTURE ACTIONS — pure data, split out of the registry to keep
 * both files under the line ceiling.
 *
 * Every entry names the service and the rule that decide. A route is declared
 * here when its decision needs the RELATIONSHIP (active membership, active
 * assignment, plan manager), not just the caller's capability.
 */

const DELEGATED_VENTURE_ACTIONS = [
  // ── Venture — la décision est un helper de périmètre nommé ─────────────────
  // Toutes ces routes exigent déjà la relation (membre actif, affectation
  // active, gestionnaire du plan). Le helper lit l'affectation ET la capacité
  // venture ; la route ne porte aucun libellé de rôle.
  {
    file: "src/app/api/ventures/[id]/coach-invite/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Inviter un coach est un acte de gestion du plan, borné par l'affectation et la capacité venture.",
  },
  {
    file: "src/app/api/ventures/[id]/document-types/[typeId]/route.js",
    service: "src/services/ventures/ventureDocumentTypes.js",
    rule: "canManageVentureDocumentTypes",
    reason: "Modifier un type de document est un acte de gestion, borné à la venture de l'URL.",
  },
  {
    file: "src/app/api/ventures/[id]/founders/[founderId]/route.js",
    service: "src/services/ventures/founders.js",
    rule: "canManageFounders",
    reason: "Gérer les fondateurs exige l'autorité sur cette venture ; la route ne lit que le verdict.",
  },
  {
    file: "src/app/api/ventures/[id]/founders/[founderId]/reactivate/route.js",
    service: "src/services/ventures/founders.js",
    rule: "canManageFounders",
    reason: "Réactiver un fondateur suit la même autorité sur la venture.",
  },
  {
    file: "src/app/api/ventures/[id]/founders/[founderId]/suspend/route.js",
    service: "src/services/ventures/founders.js",
    rule: "canManageFounders",
    reason: "Suspendre un fondateur suit la même autorité sur la venture.",
  },
  {
    file: "src/app/api/ventures/[id]/founders/transfer-ownership/route.js",
    service: "src/services/ventures/founders.js",
    rule: "canManageFounders",
    reason: "Transférer la propriété est l'acte le plus fort sur les fondateurs ; même décision centralisée.",
  },
  {
    file: "src/app/api/ventures/[id]/journey/apply-journey-template/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Appliquer un modèle de parcours est une écriture du plan, bornée par l'affectation et la capacité venture.",
  },
  {
    file: "src/app/api/ventures/[id]/journey/apply-template/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Appliquer un modèle de parcours suit la même décision de plan.",
  },
  {
    file: "src/app/api/ventures/[id]/journey/archive/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Archiver ou restaurer un parcours est une gestion de plan, jamais une destruction.",
  },
  {
    file: "src/app/api/ventures/[id]/journey/delete/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction(\"delete\")",
    reason: "La suppression définitive n'est jamais déléguée : le helper répond oui au seul propriétaire de la plateforme, et tout autre archive.",
  },
  {
    file: "src/app/api/ventures/[id]/journey/duplicate/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Dupliquer un parcours est une écriture du plan, bornée par l'affectation et la capacité venture.",
  },
  {
    file: "src/app/api/ventures/[id]/journey/save-template/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Enregistrer un parcours comme modèle lit le plan de la venture ; même décision de périmètre.",
  },
  {
    file: "src/app/api/ventures/[id]/my-access/route.js",
    service: "src/services/ventures/permissions.js",
    rule: "hasVentureCapability + resolveVentureScopedDecision (implémenté dans src/lib/ventureScopedAccess.js)",
    reason: "Cette route ne décide rien : elle rend à l'écran le verdict exact du garde, pour que l'interface n'invente pas de règle.",
  },
  {
    file: "src/app/api/ventures/[id]/notes/route.js",
    service: "src/services/ventures/permissions.js",
    rule: "hasVentureCapability + portée de l'affectation active (src/models/ventureWorkspace.js)",
    reason: "Les notes internes sont un instrument du personnel affecté ; visibilité et écriture lisent l'affectation active et la zone internal_notes.",
  },
  {
    file: "src/app/api/ventures/[id]/operating-plans/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Lister et créer un plan de fonctionnement suit la décision de plan (affectation + capacité venture).",
  },
  {
    file: "src/app/api/ventures/[id]/operating-plans/[planId]/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Lire et modifier un plan précis suit la même décision de périmètre.",
  },
  {
    file: "src/app/api/ventures/[id]/operating-plans/[planId]/sections/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction",
    reason: "Les sections d'un plan sont bornées par la même décision que le plan.",
  },
  {
    file: "src/app/api/ventures/[id]/progress-reports/route.js",
    service: "src/services/ventures/operatingPlans.js",
    rule: "resolvePlanAccess / allowsPlanAction + isStaffActorForVenture",
    reason: "Les rapports d'avancement distinguent l'acteur du personnel de la venture du reste ; la décision a besoin de la relation.",
  },
  {
    file: "src/app/api/ventures/[id]/startup-profile/route.js",
    service: "src/services/ventures/profile.js",
    rule: "canReadStartupProfile / canEditStartupProfile",
    reason: "Lire et modifier le profil de démarrage dépend de qui porte la venture ; le helper nomme la règle une seule fois.",
  },
  {
    file: "src/app/api/ventures/[id]/startup-profile/submit/route.js",
    service: "src/services/ventures/profile.js",
    rule: "canEditStartupProfile",
    reason: "Soumettre le profil est une écriture, soumise à la même autorité que l'édition.",
  },
  {
    file: "src/app/api/ventures/[id]/verification/route.js",
    service: "src/services/ventures/verification.js",
    rule: "canSubmitVerification + canAccessVerification (membre actif ou affectation active)",
    reason: "La vérification est lue par un membre actif, une affectation active ou le propriétaire de la plateforme ; la décision a besoin de la relation.",
  },
  {
    file: "src/app/api/ventures/[id]/verification/status/route.js",
    service: "src/services/ventures/verification.js",
    rule: "canManageVerification",
    reason: "Changer le statut de vérification est un acte de gestion, borné à la venture.",
  },
  {
    file: "src/app/api/ventures/[id]/verification/documents/[docId]/versions/route.js",
    service: "src/services/ventures/verification.js",
    rule: "canSubmitVerification + canAccessVerification",
    reason: "Les versions d'un document de vérification suivent la même autorité que la vérification elle-même.",
  },
];

module.exports = { DELEGATED_VENTURE_ACTIONS };
