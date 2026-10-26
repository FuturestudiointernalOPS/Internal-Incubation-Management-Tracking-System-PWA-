# Menaces, recette et preuves à recueillir

**Statut : scénarios préparés, aucun scénario exécuté.** Fixtures futures : organisation interne Future Studio, organisations fictives A/B, même personne membre de A et B, comptes séparés admin/coach/participant/investisseur, un cours licencié et des résultats distincts. Aucun besoin de données personnelles réelles.

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
| T09 | Même personne, même cours licencié chez A/B | Inscriptions et résultats A/B séparés ; pas de réutilisation involontaire des tentatives/certificats. | D06 |
| T10 | Coach/investisseur consulte notes ou résultats non partagés | Uniquement ressources explicitement autorisées, jamais notes internes ou résultats d'autres apprenants. | Affectations et partages |
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

Suites repérées, sans exécution dans cette phase :

- `src/__tests__/authorization-resolver.core.test.js`, `.advanced.test.js`, `.lms.test.js`, `.modules.test.js`, `.migrations.test.js` ;
- `src/__tests__/phase5-scope-engine.test.js` ;
- `src/__tests__/program-scoped-access.test.js`, `program-scope-wiring.test.js`, `program-scope-coverage.test.js` ;
- `src/__tests__/lms-learning.test.js`, `lms-api.courses.test.js`, `lms-api.assessments.test.js` ;
- `src/__tests__/venture-access-cache.test.js` ;
- `src/__tests__/server/auth-boundaries.test.js`, `server/services-boundaries.test.js` ;
- `src/__tests__/route-catalog-contract.test.js`.

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
