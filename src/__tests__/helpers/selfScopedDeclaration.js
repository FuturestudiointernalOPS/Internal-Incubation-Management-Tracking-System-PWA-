/**
 * PHASE 6 — DÉCLARATIONS « PERSONNELLE_LEGITIME » (spec §13).
 *
 * Une route PERSONNELLE_LEGITIME est ouverte à TOUT utilisateur connecté, et sa
 * portée est **soi-même** : elle ne lit et n'écrit que les données de
 * l'appelant, jamais un identifiant fourni par le client. C'est une déclaration
 * EXPLICITE — une route sans décision de permission n'est acceptable que si elle
 * figure ici avec la raison de sa légitimité.
 *
 * Le périmètre surveillé par le ratchet est `src/app/api/me/**` et
 * `src/app/api/profile/**` : toute route qui y apparaît SANS figurer ci-dessous
 * fait échouer le test. La liste est un cliquet — on l'ajoute sciemment, jamais
 * par réflexe.
 *
 * Les familles NON uniformes (ex. `participant/*`, dont certaines routes portent
 * une décision déléguée) sont déclarées **route par route**, jamais par préfixe :
 * chaque entrée doit être justifiée individuellement.
 *
 * `scope` documente la contrainte vérifiée par les tests comportementaux :
 * la route doit résoudre sa cible depuis `session.cid`, jamais depuis le corps ou
 * la requête.
 */
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
  {
    file: "src/app/api/participant/announcements/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Annonces visibles par l'appelant.",
  },
  {
    file: "src/app/api/participant/assignments/route.js",
    methods: ["GET", "POST"],
    scope: "session.cid",
    reason: "Soumissions d'assignation de l'appelant (`getSessionCid` → `session?.cid`).",
  },
  {
    file: "src/app/api/participant/certificates/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Certificats de l'appelant.",
  },
  {
    file: "src/app/api/participant/followups/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Rappels de suivi de l'appelant.",
  },
  {
    file: "src/app/api/participant/home/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Tableau de bord de l'appelant.",
  },
  {
    file: "src/app/api/participant/programs/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Programmes de l'appelant.",
  },
  {
    file: "src/app/api/participant/programs/[id]/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Un programme de l'appelant (`id` identify le PROGRAMME, le porteur reste `session.cid`).",
  },
  {
    file: "src/app/api/participant/progress/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Progression de l'appelant.",
  },
  {
    file: "src/app/api/participant/timeline/route.js",
    methods: ["GET"],
    scope: "session.cid",
    reason: "Chronologie de l'appelant.",
  },
];

/** Les préfixes d'API dont CHAQUE route doit être déclarée ci-dessus. */
const SELF_SCOPED_PREFIXES = ["src/app/api/me/", "src/app/api/profile/"];

module.exports = { SELF_SCOPED_ROUTES, SELF_SCOPED_PREFIXES };
