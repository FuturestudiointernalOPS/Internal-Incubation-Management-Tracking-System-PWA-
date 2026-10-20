/**
 * ACTION DECLARATIONS — the explicit registry of API actions that carry NO
 * permission decision (spec §13), and WHY each is acceptable.
 *
 * Two families (both serve the Permission Center's "open actions" view):
 *
 *   SELF_SCOPED_ROUTES  — PERSONNELLE_LEGITIME: open to ANY connected user,
 *     scope = the caller themselves (`session.cid`), never a client-supplied id.
 *
 *   OPEN_ASSUMED_ROUTES — OUVERTE_ASSUMEE: public by design (intake, auth flow,
 *     token) or guarded by a secret (scheduled task / webhook signature).
 *
 * This module is the SOURCE OF TRUTH: the static-guard tests read it (a new
 * open route must be declared here), and the admin API serves it. It contains no
 * React and no DB import — pure data.
 *
 * The lists are ratchets: they may only be edited deliberately, never padded.
 */

/** Routes open to any connected user, whose scope is the caller's OWN data. */
const SELF_SCOPED_ROUTES = [
  {
    file: "src/app/api/profile/route.js",
    methods: ["GET", "PUT"],
    scope: "session.cid",
    reason:
      "Lecture et mise à jour du profil de l'appelant. `session.cid` est la seule cible ; un `cid` envoyé dans le corps est ignoré.",
  },
  {
    file: "src/app/api/profile/photo/route.js",
    methods: ["POST"],
    scope: "session.cid",
    reason:
      "Téléversement de la photo de profil de l'appelant ; l'objet stocké est nommé depuis `session.cid`.",
  },
  {
    file: "src/app/api/profile/history/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Historique du profil de l'appelant, lu pour `session.cid`.",
  },
  {
    file: "src/app/api/me/permissions/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason:
      "Matrice de permissions effectives de l'appelant ; jamais une frontière de sécurité (chaque API reste autoritative).",
  },
  {
    file: "src/app/api/me/relationships/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Relations (programmes/ventures) de l'appelant.",
  },
  {
    file: "src/app/api/participant/rituals/checkin/route.js",
    methods: ["GET", "POST"],
    scope: "session.cid",
    reason: "Check-ins hebdomadaires de l'appelant ; `recordCheckin` reçoit `cid: session.cid`.",
  },
  {
    file: "src/app/api/participant/rituals/reflect/route.js",
    methods: ["GET", "POST"],
    scope: "session.cid",
    reason: "Réflexions de l'appelant ; `recordReflection` reçoit `cid: session.cid`.",
  },
  {
    file: "src/app/api/participant/rituals/retro/route.js",
    methods: ["GET", "POST"],
    scope: "session.cid",
    reason: "Rétros de l'appelant ; `recordRetro` reçoit `cid: session.cid`.",
  },
  {
    file: "src/app/api/participant/rituals/standup/route.js",
    methods: ["GET", "POST"],
    scope: "session.cid",
    reason: "Standups de l'appelant ; `recordStandup` reçoit `cid: session.cid`.",
  },
  // Lectures self-service du participant (hors `full-state` et `submissions`,
  // qui portent une décision déléguée et ne sont donc PAS déclarées ici).
  { file: "src/app/api/participant/announcements/route.js", methods: ["GET"], scope: "session.cid", reason: "Annonces visibles par l'appelant." },
  { file: "src/app/api/participant/assignments/route.js", methods: ["GET", "POST"], scope: "session.cid", reason: "Soumissions d'assignation de l'appelant (`getSessionCid` → `session?.cid`)." },
  { file: "src/app/api/participant/certificates/route.js", methods: ["GET"], scope: "session.cid", reason: "Certificats de l'appelant." },
  { file: "src/app/api/participant/followups/route.js", methods: ["GET"], scope: "session.cid", reason: "Rappels de suivi de l'appelant." },
  { file: "src/app/api/participant/home/route.js", methods: ["GET"], scope: "session.cid", reason: "Tableau de bord de l'appelant." },
  { file: "src/app/api/participant/programs/route.js", methods: ["GET"], scope: "session.cid", reason: "Programmes de l'appelant." },
  { file: "src/app/api/participant/programs/[id]/route.js", methods: ["GET"], scope: "session.cid", reason: "Un programme de l'appelant (`id` identify le PROGRAMME, le porteur reste `session.cid`)." },
  { file: "src/app/api/participant/progress/route.js", methods: ["GET"], scope: "session.cid", reason: "Progression de l'appelant." },
  { file: "src/app/api/participant/timeline/route.js", methods: ["GET"], scope: "session.cid", reason: "Chronologie de l'appelant." },
  // Google Calendar — le calendrier de l'utilisateur (hors `cron` et `webhook`,
  // gardés par secret/jeton, et hors `connect`, flux OAuth sans donnée propre).
  { file: "src/app/api/integrations/google-calendar/callback/route.js", methods: ["GET"], scope: "session.cid", reason: "Retour OAuth : `completeConnect` reçoit `userId: session.cid`." },
  { file: "src/app/api/integrations/google-calendar/route.js", methods: ["GET", "DELETE"], scope: "session.cid", reason: "Statut de connexion et déconnexion du calendrier de l'appelant." },
  { file: "src/app/api/integrations/google-calendar/events/route.js", methods: ["GET"], scope: "session.cid", reason: "Événements affichés pour l'appelant." },
  { file: "src/app/api/integrations/google-calendar/sync/route.js", methods: ["POST"], scope: "session.cid", reason: "Synchronisation manuelle du calendrier de l'appelant." },
  // Auth self-service : la session et la langue de l'appelant.
  { file: "src/app/api/auth/session/route.js", methods: ["GET"], scope: "session.cid", reason: "Renvoie la session de l'appelant." },
  { file: "src/app/api/auth/language/route.js", methods: ["PUT"], scope: "session.cid", reason: "Change la langue de l'appelant (`session.cid`)." },
  // LMS — expérience APPRENANT (hors gestion de cours, gardée par `lms.edit`).
  { file: "src/app/api/lms/my-learning/route.js", methods: ["GET"], scope: "session.cid", reason: "Catalogue d'apprentissage de l'appelant." },
  { file: "src/app/api/lms/courses/[id]/learn/route.js", methods: ["GET"], scope: "session.cid", reason: "Contenu d'un cours pour l'appelant (`getLearnerCourse(id, session.cid)`)." },
  { file: "src/app/api/lms/lessons/[id]/complete/route.js", methods: ["POST"], scope: "session.cid", reason: "Marque une leçon terminée pour l'appelant (`completeLesson(id, session.cid)`)." },
  { file: "src/app/api/lms/assessments/[id]/take/route.js", methods: ["GET"], scope: "session.cid", reason: "Évaluation à passer pour l'appelant (`getAssessmentForTake(id, session.cid)`)." },
  { file: "src/app/api/lms/assessments/[id]/submit/route.js", methods: ["POST"], scope: "session.cid", reason: "Remise d'évaluation par l'appelant (`submitAssessment(id, session.cid, …)`)." },
  { file: "src/app/api/lms/certificates/route.js", methods: ["GET"], scope: "session.cid", reason: "Certificats de l'appelant (`getCertificatesForLearner(session.cid)`)." },
  { file: "src/app/api/lms/certificates/[id]/route.js", methods: ["GET"], scope: "session.cid", reason: "Un certificat de l'appelant (`getLearnerCertificate(id, session.cid)`)." },
  { file: "src/app/api/lms/certificates/[id]/download/route.js", methods: ["GET"], scope: "session.cid", reason: "Téléchargement d'un certificat de l'appelant (`getLearnerCertificate(id, session.cid)`)." },
];

/** Routes open by design (public or secret-guarded), with the written reason. */
const OPEN_ASSUMED_ROUTES = [
  { file: "src/app/api/auth/login/route.js", kind: "auth-flow", reason: "Authentification : identifiants vérifiés, rate-limitée, anti-énumération + égalisation de temps." },
  { file: "src/app/api/auth/session-login/route.js", kind: "auth-flow", reason: "Authentification (sœur de `login`) : identifiants vérifiés, rate-limitée, égalisation de temps." },
  { file: "src/app/api/auth/activate/route.js", kind: "auth-flow", reason: "Activation de compte par jeton (rate-limit + jeton)." },
  { file: "src/app/api/auth/forgot-password/route.js", kind: "auth-flow", reason: "Envoi d'un lien de réinitialisation (rate-limit + anti-énumération)." },
  { file: "src/app/api/auth/setup-password/route.js", kind: "auth-flow", reason: "Définition de mot de passe par jeton (rate-limit + jeton)." },
  { file: "src/app/api/auth/setup-password/validate/route.js", kind: "auth-flow", reason: "Validation d'un jeton de configuration (rate-limit + jeton)." },
  { file: "src/app/api/investor/setup-password/route.js", kind: "auth-flow", reason: "Définition de mot de passe investisseur par jeton." },
  { file: "src/app/api/investor/register/route.js", kind: "auth-flow", reason: "Flux retiré (HTTP 410) — n'expose aucune donnée." },
  { file: "src/app/api/invites/[token]/route.js", kind: "token", reason: "Validation d'un jeton d'invitation (unguessable)." },
  { file: "src/app/api/venture-member-invites/[token]/route.js", kind: "token", reason: "Invitation membre de venture par jeton." },
  { file: "src/app/api/verify/certificate/[token]/route.js", kind: "token", reason: "Vérification publique de certificat ; champs volontairement publics." },
  { file: "src/app/api/public/checkout/route.js", kind: "public-intake", reason: "État / paiement de checkout public (rate-limit)." },
  { file: "src/app/api/public/course-match/route.js", kind: "public-intake", reason: "Catalogue public (rate-limit)." },
  { file: "src/app/api/public/group-info/route.js", kind: "public-intake", reason: "Info de groupe pour la page d'inscription (réserve : énumérable par identifiant)." },
  { file: "src/app/api/public/register/route.js", kind: "public-intake", reason: "Inscription publique via lien de groupe (garde de conflit de rôle)." },
  { file: "src/app/api/s/public-draft/route.js", kind: "public-intake", reason: "Brouillon de formulaire public : jeton + slug, rate-limit à la création." },
  { file: "src/app/api/s/public-run/route.js", kind: "public-intake", reason: "Lecture publique d'un run par slug (les id numériques sont refusés)." },
  { file: "src/app/api/s/public-submit/route.js", kind: "public-intake", reason: "Soumission publique : jeton navigateur + limite par run." },
  { file: "src/app/api/engineering/permissions/context-grants-sweep/route.js", kind: "cron", reason: "Balayage planifié des octrois de contexte : 503 si le secret n'est pas configuré, 403 s'il est erroné." },
  { file: "src/app/api/integrations/google-calendar/cron/route.js", kind: "cron", reason: "Synchronisation planifiée (x-cron-secret ou Bearer)." },
  { file: "src/app/api/lms/checkout-reconcile/route.js", kind: "cron", reason: "Réconciliation de paiements planifiée (secret)." },
  { file: "src/app/api/notifications/due-reminders/route.js", kind: "cron", reason: "Rappels planifiés (secret)." },
  { file: "src/app/api/notifications/overdue/route.js", kind: "cron", reason: "Relances planifiées (secret)." },
  { file: "src/app/api/platform/scheduled-result-emails/route.js", kind: "cron", reason: "Envoi planifié des courriels de résultat (secret)." },
  { file: "src/app/api/reminders/sweep/route.js", kind: "cron", reason: "Balayage planifié des rappels (secret)." },
  { file: "src/app/api/tasks/notify-deadlines/route.js", kind: "cron", reason: "Notifications d'échéance planifiées (secret)." },
  { file: "src/app/api/webhooks/kkiapay/route.js", kind: "webhook", reason: "Webhook de paiement signé par le fournisseur ; 401 si la signature est invalide." },
  { file: "src/app/api/integrations/google-calendar/webhook/route.js", kind: "webhook", reason: "Notification push Google ; jeton de canal vérifié." },
  { file: "src/app/api/health/route.js", kind: "probe", reason: "Sonde de santé publique ; n'expose aucune donnée métier." },
  { file: "src/app/api/ready/route.js", kind: "probe", reason: "Sonde de disponibilité." },
];

/** API prefixes whose every route MUST be declared as self-scoped. */
const SELF_SCOPED_PREFIXES = ["src/app/api/me/", "src/app/api/profile/"];

/** Mechanisms that ARE a permission decision (exclude a route from "open"). */
const DECISION_MECHANISMS = [
  "requireAuthorization(",
  "requireScopedAccess(",
  "requireVenture",
  "requireProgramScope",
  "requireAssignmentAccess",
  "requireProjectAccess",
  "requireProgramFacilitator(",
  "requireProgramManagerAccess(",
  "requireInvestorSelfServiceAuthorization(",
];

/** Opening by SECRET (scheduled task / signature). */
const SECRET_MECHANISMS = ["x-cron-secret", "verifyWebhookSignature"];

/** Human label of each `kind`, keyed for the UI. */
const OPEN_ASSUMED_KINDS = ["public-intake", "auth-flow", "token", "cron", "webhook", "probe"];

/**
 * ROUTE_HUBS / NO_GUARD_ALLOWED — the two remaining OPEN exceptions that used
 * to live inside the static-guard test. They move here so ONE registry answers
 * "what is this action allowed to rely on?", instead of a test file owning part
 * of the policy.
 */

/** Routes that are only a re-export hub: the decisions live in the handlers. */
const ROUTE_HUBS = new Set([
  "src/app/api/platform/form-runs/route.js",
]);

/**
 * Routes with no statically readable permission decision, each with the reason
 * it is still acceptable. These are OPEN declarations, not tacit exemptions.
 */
const NO_GUARD_ALLOWED = new Set([
  // Stubs : répondent toujours 501 « feature not available in this schema ».
  "src/app/api/forms/route.js",
  "src/app/api/forms/[form_id]/route.js",
  // Décision déléguée : services/programs/participantPrograms.js
  // (requireAuthorization("programs","view") / requireAuth([...]) /
  // requireProgramScope), remontée par `isAuthError`.
  "src/app/api/participant-programs/route.js",
  // Intake public : enregistre une réponse de campagne
  // (services/platformRespond, validation dans le service).
  "src/app/api/respond/route.js",
  // Webhook : signature Svix vérifiée dans @/services/email
  // (processResendWebhook) ; le fichier ne fait que lire le secret.
  "src/app/api/webhooks/resend/route.js",
  // Flux d'auth sans session par conception : vérifie le mot de passe courant
  // + rate-limit (pas de permission à contrôler).
  "src/app/api/auth/reset-password/route.js",
  // Déconnexion : détruit la session (pas de permission à contrôler).
  "src/app/api/auth/session-logout/route.js",
]);

/**
 * DELEGATED_DECISIONS — routes whose permission decision lives in a SERVICE.
 *
 * The static scan can only see a decision written in the route file. Where the
 * rule genuinely belongs to a service (it needs the target's relationship, not
 * just the caller's role), the route declares the delegation instead of copying
 * the rule into the route and letting the two drift.
 *
 * This is a DECLARATION, not an exemption: it names the service and the rule, so
 * a reviewer can follow it, and the route leaves the debt list.
 */
const DELEGATED_DECISIONS = [
  {
    file: "src/app/api/contact-emails/route.js",
    service: "src/services/contacts/alternativeEmails.js",
    rule: "canManageContactEmails",
    reason:
      "Alternative emails : l'appelant gère sa propre identité, ou celle d'une autre personne seulement dans un programme partagé. La règle a besoin de la relation avec la cible, donc elle vit dans le service ; la route ne porte aucune capacité littérale.",
  },
];

/**
 * DECLARATION SCHEMA (Lot 4, step 4.1)
 *
 * Every API action belongs to exactly one kind:
 *
 *   capability — it calls a DECISION_MECHANISM (a capability, a perimeter, or
 *                both). This is the target for every protected action.
 *   delegated  — the decision lives in a service, named here with its rule.
 *   self       — open to any connected user, scoped to `session.cid`.
 *   open       — public by design, secret-guarded, a hub or a documented stub.
 *
 * An action that is none of the four is UNDECLARED debt: listed in
 * `actionDebt.js`, frozen so it can only shrink (step 4.2 works it down).
 */
const DECLARED_ACTION_KINDS = ["capability", "delegated", "self", "open"];

module.exports = {
  SELF_SCOPED_ROUTES,
  OPEN_ASSUMED_ROUTES,
  DELEGATED_DECISIONS,
  SELF_SCOPED_PREFIXES,
  DECISION_MECHANISMS,
  SECRET_MECHANISMS,
  OPEN_ASSUMED_KINDS,
  ROUTE_HUBS,
  NO_GUARD_ALLOWED,
  DECLARED_ACTION_KINDS,
};
