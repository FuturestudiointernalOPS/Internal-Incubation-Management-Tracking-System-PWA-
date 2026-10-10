/**
 * PHASE 6 — DÉCLARATIONS « OUVERTE_ASSUMEE » (spec §13).
 *
 * Une route OUVERTE_ASSUMEE n'est PAS protégée par une décision de permission,
 * et c'est un CHOIX : elle est publique par conception (intake, flux d'auth,
 * jeton) ou gardée par un secret (tâche planifiée / signature de webhook). Une
 * telle route n'est acceptable que si elle figure ici avec sa justification.
 *
 * `kind` :
 *   - `public-intake` : formulaire/intake public assumé (borné : jeton, rate-limit).
 *   - `auth-flow`     : authentification / définition de mot de passe (pré-session).
 *   - `token`         : vérification par jeton unguessable.
 *   - `cron`          : tâche planifiée gardée par `x-cron-secret`/Bearer.
 *   - `webhook`       : webhook à signature vérifiée.
 *   - `probe`         : sonde d'infrastructure (aucune donnée métier).
 *
 * La liste est un cliquet : toute route publique/secret SANS décision de
 * permission doit être déclarée ici (le test le vérifie), et aucune entrée ne
 * doit rester une fois la route supprimée.
 */
const OPEN_ASSUMED_ROUTES = [
  // ── Auth flows (pré-session) ──────────────────────────────────────────────
  { file: "src/app/api/auth/login/route.js", kind: "auth-flow", reason: "Authentification : identifiants vérifiés, rate-limitée, anti-énumération + égalisation de temps." },
  { file: "src/app/api/auth/session-login/route.js", kind: "auth-flow", reason: "Authentification (sœur de `login`) : identifiants vérifiés, rate-limitée, égalisation de temps." },
  { file: "src/app/api/auth/activate/route.js", kind: "auth-flow", reason: "Activation de compte par jeton (rate-limit + jeton)." },
  { file: "src/app/api/auth/forgot-password/route.js", kind: "auth-flow", reason: "Envoi d'un lien de réinitialisation (rate-limit + anti-énumération)." },
  { file: "src/app/api/auth/setup-password/route.js", kind: "auth-flow", reason: "Définition de mot de passe par jeton (rate-limit + jeton)." },
  { file: "src/app/api/auth/setup-password/validate/route.js", kind: "auth-flow", reason: "Validation d'un jeton de configuration (rate-limit + jeton)." },
  { file: "src/app/api/investor/setup-password/route.js", kind: "auth-flow", reason: "Définition de mot de passe investisseur par jeton." },
  { file: "src/app/api/investor/register/route.js", kind: "auth-flow", reason: "Flux retiré (HTTP 410) — n'expose aucune donnée." },

  // ── Vérification par jeton ────────────────────────────────────────────────
  { file: "src/app/api/invites/[token]/route.js", kind: "token", reason: "Validation d'un jeton d'invitation (unguessable)." },
  { file: "src/app/api/venture-member-invites/[token]/route.js", kind: "token", reason: "Invitation membre de venture par jeton." },
  { file: "src/app/api/verify/certificate/[token]/route.js", kind: "token", reason: "Vérification publique de certificat ; champs volontairement publics." },

  // ── Intake public ─────────────────────────────────────────────────────────
  { file: "src/app/api/public/checkout/route.js", kind: "public-intake", reason: "État / paiement de checkout public (rate-limit)." },
  { file: "src/app/api/public/course-match/route.js", kind: "public-intake", reason: "Catalogue public (rate-limit)." },
  { file: "src/app/api/public/group-info/route.js", kind: "public-intake", reason: "Info de groupe pour la page d'inscription (réserve : énumérable par identifiant)." },
  { file: "src/app/api/public/register/route.js", kind: "public-intake", reason: "Inscription publique via lien de groupe (garde de conflit de rôle)." },
  { file: "src/app/api/s/public-draft/route.js", kind: "public-intake", reason: "Brouillon de formulaire public : jeton + slug, rate-limit à la création." },
  { file: "src/app/api/s/public-run/route.js", kind: "public-intake", reason: "Lecture publique d'un run par slug (les id numériques sont refusés)." },
  { file: "src/app/api/s/public-submit/route.js", kind: "public-intake", reason: "Soumission publique : jeton navigateur + limite par run." },

  // ── Tâches planifiées (secret) ────────────────────────────────────────────
  { file: "src/app/api/engineering/permissions/context-grants-sweep/route.js", kind: "cron", reason: "Balayage planifié des octrois de contexte : 503 si le secret n'est pas configuré, 403 s'il est erroné." },
  { file: "src/app/api/integrations/google-calendar/cron/route.js", kind: "cron", reason: "Synchronisation planifiée (x-cron-secret ou Bearer)." },
  { file: "src/app/api/lms/checkout-reconcile/route.js", kind: "cron", reason: "Réconciliation de paiements planifiée (secret)." },
  { file: "src/app/api/notifications/due-reminders/route.js", kind: "cron", reason: "Rappels planifiés (secret)." },
  { file: "src/app/api/notifications/overdue/route.js", kind: "cron", reason: "Relances planifiées (secret)." },
  { file: "src/app/api/platform/scheduled-result-emails/route.js", kind: "cron", reason: "Envoi planifié des courriels de résultat (secret)." },
  { file: "src/app/api/reminders/sweep/route.js", kind: "cron", reason: "Balayage planifié des rappels (secret)." },
  { file: "src/app/api/tasks/notify-deadlines/route.js", kind: "cron", reason: "Notifications d'échéance planifiées (secret)." },

  // ── Webhooks signés ───────────────────────────────────────────────────────
  { file: "src/app/api/webhooks/kkiapay/route.js", kind: "webhook", reason: "Webhook de paiement signé par le fournisseur ; 401 si la signature est invalide." },
  { file: "src/app/api/integrations/google-calendar/webhook/route.js", kind: "webhook", reason: "Notification push Google ; jeton de canal vérifié." },

  // ── Sondes d'infrastructure ───────────────────────────────────────────────
  { file: "src/app/api/health/route.js", kind: "probe", reason: "Sonde de santé publique ; n'expose aucune donnée métier." },
  { file: "src/app/api/ready/route.js", kind: "probe", reason: "Sonde de disponibilité." },
];

/** Mécanismes qui constituent une DÉCISION de permission (excluent du « ouvert »). */
const DECISION_MECHANISMS = [
  "requireAuthorization(",
  "requireScopedAccess(",
  "requireVenture",
  "requireProgramScope",
  "requireAssignmentAccess",
  "requireProjectAccess",
  "requireProgramFacilitator",
  "requireInvestorSelfServiceAuthorization(",
];

/** Ouverture par SECRET (tâche planifiée / signature). */
const SECRET_MECHANISMS = ["x-cron-secret", "verifyWebhookSignature"];

module.exports = { OPEN_ASSUMED_ROUTES, DECISION_MECHANISMS, SECRET_MECHANISMS };
