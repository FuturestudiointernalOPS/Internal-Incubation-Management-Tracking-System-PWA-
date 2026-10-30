# Menaces, recette et preuves à recueillir

**Statut au 29 octobre 2026 : revue statique locale partielle et tests ciblés exécutés ; recette navigateur/staging non exécutée.** Fixtures futures : organisation interne Future Studio, organisations fictives A/B, même personne membre de A et B, comptes séparés admin/coach/participant/investisseur, un cours licencié et des résultats distincts. Aucun besoin de données personnelles réelles.

## 0. Résultat de la revue locale ciblée — 29 octobre

### Contrôles confirmés dans la tranche examinée

- Les routes client `/api/org/**` et les lectures supervisées passent par la
  frontière privée dédiée : résolution de session sans `initDb`, cache de
  session interne ni backfill de jeton ; réponses `private, no-store`.
- Le service client relit l'organisation active depuis la session serveur.
  `X-Organization-Id` est une précondition de fraîcheur, pas une autorité de
  sélection. Les lectures Programme filtrent par organisation, périmètre et
  refus explicites ; les identifiants étrangers et absents ne sont pas distingués.
- Le premier endpoint `/api/org/lms` relit le même contexte actif et exige le
  module LMS, une appartenance/contrat valides et une capacité d'organisation
  explicite. `lms_learner` ne lit que ses inscriptions, tentatives et certificats
  dans l'organisation active ; `lms_content_manager` ne reçoit que le catalogue
  possédé ou licencié à cette organisation. Les cours licenciés ne sont exposés
  au catalogue que si la licence est active et dans sa période.
- L'endpoint `/api/org/ventures` exige une capacité explicite
  `venture.assigned.read` et ne renvoie que les ventures possédées par
  l'organisation active auxquelles le membre a une adhésion ou une affectation
  staff active. Les enregistrements historiques restent rattachés à Future
  Studio. Cette tranche est limitée à une liste en lecture seule ; elle ne prouve
  pas l'isolation des détails, pièces jointes, anciennes APIs ou écritures.
- Les routes d'écriture examinées vérifient l'origine, le JSON et la taille de
  la requête. Les écritures sont auditées et vérifient l'appartenance/capacité ;
  les contrôles de révision, fermeture, verrouillage de session et relecture
  d'accès avant validation sont présents dans le chemin Programme.
- Les nouvelles tables activent RLS sans politique navigateur permissive ; les
  tests SQL isolés ont vérifié le refus du rôle navigateur. Les références
  composites et les triggers limitent les associations à la même organisation
  et protègent l'historique.
- Des tests statiques et SQL vérifient des surfaces internes ciblées : les
  lecteurs Programme platform-only examinés, les 14 lectures du workspace et
  les cinq exports concernés. Cela ne constitue pas un inventaire exhaustif
  des routes, services, fichiers ou tâches.

### Vérifications exécutées

- 150 tests / 9 suites sur les routes, services et modèles d'organisation,
  l'accès interne Programme, le workspace et les exports.
- 47 tests / 5 suites sur le câblage et le recensement des gardes d'autorisation.
  Deux contrats de tests devenus obsolètes après le merge ont été actualisés.
- Six migrations appliquées deux fois et scénarios synthétiques Programme,
  contexte, supervision et branding passés dans PostgreSQL 16 hors réseau.
- **527 tests / 42 suites** couvrent le LMS existant, le nouveau contrôle
  d'organisation, le portail et les régressions client.
- Dix migrations white-label/LMS/Venture appliquées deux fois dans PostgreSQL 16
  synthétique hors réseau : rattachement plateforme des anciennes données,
  inscription sous licence, tentatives séparées par organisation, certificat
  limité à son inscription, immutabilité des propriétaires, capacité Venture
  explicite et périmètre des affectations membre/staff.
- Les tests ciblés d'accès, service, dépôt, contexte et portail Venture passent :
  **55 tests / 5 suites**. La migration Venture et sa fixture d'acceptation
  passent également dans le runner PostgreSQL isolé.
- Ces résultats sont locaux et synthétiques. Aucun essai navigateur ou staging,
  aucune simulation concurrente de révocation, aucun test de charge et aucune
  validation du schéma staging complet ne sont revendiqués. Le parcours de
  lecture LMS/Venture n'est donc pas encore ouvert à un client réel.

### Limites restant bloquantes

- Les APIs legacy et leurs effets indirects ne sont pas intégralement recensés.
  Les routes `/api/programs`, `/api/pm/programs`, `/api/participant/programs`,
  `/api/contacts/[cid]/programs`, `/api/v2/program-staff` et
  `/api/lms/program-requirements` utilisent encore les chemins d'authentification
  ou de schéma généraux. Le parcours client dédié ne les appelle pas, mais leur
  comportement pour une identité ayant à la fois un compte client et des droits
  historiques doit être établi avant l'ouverture.
- **Ressources participant — corrigé localement, staging à valider :**
  `/api/participant/programs/[id]` vérifie l'inscription au programme demandé
  puis ne charge que la note non archivée référencée par `program.note_id` ;
  les pièces jointes sont récupérées uniquement pour cette note. Si aucun
  `note_id` n'est défini, aucune ressource Knowledge Bank n'est exposée. Les
  tests `participant-program-detail-knowledge-{model,service}.test.js` couvrent
  le filtre et son câblage. Le schéma ne permet actuellement qu'une note liée
  directement au programme ; tout besoin de plusieurs ressources devra passer
  par une relation explicite programme-ressource, pas par un retour global.
- Fichiers et liens signés, invitations/acceptations, notifications, e-mails,
  calendrier, jobs et synchronisations n'ont pas encore été tracés de bout en
  bout jusqu'à leur contrôle d'organisation et leur révocation.
- Les migrations synthétiques ne reproduisent pas les fonctions, triggers,
  politiques RLS et index non contraints de la base staging. Les effets des
  triggers existants sur les données clientes restent à confirmer.
- Les gardes de portée Programme documentent encore des exemptions legacy ;
  leurs scénarios ne prouvent pas à eux seuls la séparation complète des
  organisations ni l'absence de fuite via une autre API.
- La tranche LMS ne fournit pas encore la lecture du contenu des leçons ni le
  parcours de lecture vidéo ; elle expose le catalogue et les résultats propres
  à l'apprenant. Le nouveau listing Venture ne couvre pas les détails, pièces
  jointes, écritures ou routes legacy et ses colonnes doivent être vérifiées sur
  le schéma staging réel, dont les formes ont varié.

**Conclusion :** les tranches dédiées Programme/branding, LMS et premier listing
Venture ont des barrières et preuves automatisées ciblées, mais leur portée
diffère. T01–T20 ne sont pas clos. Maintenir l'activation client verrouillée
jusqu'à l'inventaire des chemins indirects, la validation des migrations sur
staging isolé et la recette navigateur des tranches réellement ouvertes.

## 1. Matrice minimale

| ID | Menace / cas | Preuve de réussite attendue | Dépendance |
|---|---|---|---|
| T01 | Accès sans session ou sans appartenance | Refus approprié ; aucune donnée ni compteur sensible. | Contexte et garde |
| T02 | A liste/recherche/compte les données de B | Aucune donnée privée B, ni dans les agrégats, ni dans les erreurs. | Lectures filtrées |
| T03 | A fournit l'identifiant B à une lecture ou mutation | Refus sans révélation d'existence ; aucun changement chez B. Réponse publique cohérente, diagnostic détaillé réservé au journal sûr. | Garde objet et filtres SQL |
| T04 | Un utilisateur client appelle une ancienne API interne ou publique | Aucun accès client hors autorisation, aucun cours privé ni donnée de l'interne exposés. | D02 |
| T05 | Le membre A devient admin/coach via des droits obtenus chez B | Aucun cumul entre organisations ; plafond et refus respectés. | Modèle de rôle |
| T06 | Une inscription cliente réconcilie les grants internes | Aucun rôle global ou grant interne supplémentaire injustifié. | Cartographie des effets automatiques |
| T07 | Révocation d'appartenance, rôle, module ou mandat | Effet conforme au délai approuvé, y compris autres instances et caches en vol. | D08 |
| T08 | Deux onglets d'une même session changent d'organisation | Pas de mutation silencieuse de A dans B depuis une page obsolète ; deux sessions distinctes restent indépendantes. | D09 |
| T09 | Même personne, même cours licencié chez A/B | Couvert synthétiquement : inscriptions et tentatives séparées ; certificat limité à la portée de son inscription. Le parcours navigateur et les cas de licence révoquée restent à valider sur staging. | D06 |
| T10 | Coach/investisseur consulte notes ou résultats non partagés | Uniquement ressources explicitement autorisées, jamais notes internes ou résultats d'autres apprenants. | Ressources de détail participant désormais limitées à `program.note_id` en local ; partage coach/investisseur et recette staging restent à valider. |
| T11 | Fichier B, URL transmise, export ou lien signé | Refus hors droit ; aucun fichier confidentiel public ; fichier/export limité avant génération. Définir validité d'un lien déjà signé après révocation. | Stockage et révocation |
| T12 | Invitation expirée, rejouée, rôle retiré ou mauvaise identité | Aucun accès indu ; vérifier l'identité liée à l'invitation, la délégation, les périodes et le jeton. | Invitations |
| T13 | Annonce globale, job, e-mail ou synchronisation de calendrier | Destinataires, contenu et opérations restent dans le contexte autorisé ; secret technique ≠ autorité métier globale. | Transverse |
| T14 | Support/propriétaire sans mandat ou mandat expiré | Aucun accès au contenu client ; usages autorisés tracés avec motif et dates. | D04 |
| T15 | Organisation suspendue, archivée ou contrat terminé | Organisation suspendue : refus de tout accès client, lecture comprise, sans grâce ; données conservées. Archivage, contrat et jobs suivent leurs règles validées séparément ; pas de suppression implicite. | D01 confirmée / D05 |
| T16 | Nouvelle cohorte 2028, participant déjà présent en 2027 | Résultats et inscriptions 2027 conservés ; 2028 distinct, versions utiles maintenues. | D07 |
| T17 | Nouvelle contrainte et ancienne création interne | Création Future Studio réussie, bonne attribution, absence de doublons ou d'erreurs `ON CONFLICT`. | D03 |
| T18 | GET portail censé être en lecture | Pas d'auto-activation globale, de mutation ou de mail surprise. | Réutilisation des services |
| T19 | Parcours internes après arrivée de données clientes | Droits internes légitimes maintenus et données clientes hors mandat exclues. | D02, non-régression |
| T20 | Charge et exploitation | Mesurer p95, requêtes, erreurs et jobs sous charge représentative ; seuils à approuver selon environnement. | Volumes et budgets validés |

## 2. Sources de non-régression existantes

Déjà exécutées pendant cette revue :

- `src/__tests__/program-scope-wiring.test.js`, `program-scope-coverage.test.js` ;
- `src/__tests__/route-catalog-contract.test.js`.

Repérées mais pas encore exécutées dans cette phase :

- `src/__tests__/authorization-resolver.core.test.js`, `.advanced.test.js`, `.lms.test.js`, `.modules.test.js`, `.migrations.test.js` ;
- `src/__tests__/phase5-scope-engine.test.js` ;
- `src/__tests__/program-scoped-access.test.js` ;
- `src/__tests__/lms-learning.test.js`, `lms-api.courses.test.js`, `lms-api.assessments.test.js` ;
- `src/__tests__/venture-access-cache.test.js` ;
- `src/__tests__/server/auth-boundaries.test.js`, `server/services-boundaries.test.js` ;

Les noms historiques monolithiques cités dans d'autres documents ne doivent pas être utilisés sans vérifier les fichiers actuels. Le programme `test:authz` est défini dans `package.json` ; il n'est pas synonyme de toutes les suites à exécuter.

## 3. Format des preuves du futur pilote

Pour chaque scénario : version de code, environnement confirmé, fixtures utilisées, préconditions, requête/action, réponse attendue, résultat observé, effets DB/fichiers/jobs, anomalies et correction. Automatiser les contrôles qui portent l'isolation pour chaque table finalement retenue ; une capture de page ne suffit pas.

Le registre final devra relier **table → routes/actions/jobs → contrôle d'organisation → test**. Les CSV statiques actuels constituent un point de départ, pas cette preuve terminée.

## 4. Conditions de passage

- **Avant lecture cliente :** T01–T08, T10, T14 et chemins publics affectés validés sur la tranche ouverte.
- **Avant écritures/fichiers :** T09, T11–T13, T15–T18 et audit appliqués à chaque action ajoutée.
- **Avant données réelles :** séparation dans les deux sens, parcours métier, historique, exploitation et non-régression démontrés ; décisions en attente closes sur le périmètre ; limites de revue solo explicites.
- **Avant promotion :** checklist `docs/PRODUCTION_TEST.md` item par item. Un build vert ne remplace ni le pilote ni le test de production.

Les seuils p95 proposés par le plan de réalisation sont des cibles à valider, pas des mesures obtenues ni des garanties de service. Sans équipe, la même personne peut réaliser et tester ; elle ne doit pas présenter cette vérification comme une revue indépendante.
