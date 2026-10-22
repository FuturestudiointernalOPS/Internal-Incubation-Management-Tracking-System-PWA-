# Phase 7 — D6 : profil dédié « gestionnaire de cours »

> **Nature** : ajout d'un profil (vocabulaire + seed). Aucun accès **élargi par
> défaut** : personne ne détient le profil tant qu'un administrateur ne l'assigne
> pas. Aucune donnée migrée, aucune suppression.

## 1. Origine — décision arbitrée

Arbitrage **D6** (voir `phase-1-decisions.md`, sections « D6 » et
« ARBITRAGE D6 — TRANCHÉE : option (i) ») :

- **Option (i)** retenue : accorder **le droit unique actuel de gestion des cours**
  via un **profil dédié**, porté **uniquement par le staff désigné** (jamais tout le
  staff). Le Super Admin le détient **par défaut** (bypass).
- **Conséquence assumée** : le droit unique est **indivisible** pour l'instant —
  il couvre la liste demandée (publier/dépublier, inscrire, créer des évaluations,
  révoquer un certificat, attacher des ressources) **plus** archivage de cours,
  suppression d'évaluation, vignettes et suppression de ressources.
- **Nom retenu** (défaut proposé, faute de confirmation contraire) :
  **« Gestionnaire de cours » / « Course Manager »**.

## 2. Fait de code confirmé (recherche)

Toutes les actions listées passent, dans les routes, par **un seul** droit :
`requireAuthorization("lms", "edit")` — publication
(`api/lms/courses/[id]/publish`), inscription (`api/lms/enrollments`),
évaluations (`api/lms/assessments/**`), révocation de certificat
(`api/lms/certificates/[id]/revoke`), archivage
(`api/lms/courses/[id]/archive`), vignettes (`api/lms/courses/thumbnail`).
Seul le Super Admin le détenait (`docs/AUTHZ_CURRENT_STATE.md` §9, décision D1).

## 3. Ce qui a été ajouté (code, sans données)

| Fichier | Élément |
|---|---|
| `src/models/authorization/profileCatalogueSeed.js` | entrée `course_manager` (seed DB) — `context: "staff"`, `allowedRoles: ["staff"]`, caps `lms: { view: 1, edit: 3 }` |
| `src/models/authorization/profile-catalog.js` | entrée `course_manager` dans `PROFILE_CATALOG` (vocabulaire de lecture / `isValidProfileKey`), `labelKey` i18n |
| `src/locales/en/engineering.json` | `profileCourseManager: "Course Manager"` |
| `src/locales/fr/engineering.json` | `profileCourseManager: "Gestionnaire de cours"` |

**Pourquoi `lms.view` en plus de `lms.edit`** : un gestionnaire doit pouvoir
**parcourir** les cours (les routes GET exigent `lms.view`) avant de les gérer.
`lms.create` / `lms.delete` (créer/supprimer un cours) ne sont **pas** inclus : ils
ne figurent pas dans la liste arbitrée ; à trancher si le produit veut les couvrir.

## 4. Effet d'accès

- **Aucun élargissement par défaut** : le profil n'est accordé à personne par le
  seed ; il s'assigne manuellement (People / Person Access).
- **Super Admin** : inchangé (bypass).
- **Staff sans le profil** : inchangé (`lms.edit` refusé).
- **Staff avec le profil** : `lms.edit` accordé → publier/inscrire/évaluer/révoquer.

## 5. Preuves de validation (réellement exécutées)

- Balayage profil/LMS/éligibilité/catalogue : **73 suites / 890 tests** verts,
  dont `profile-catalogue-seed`, `profile-catalog-phase-a` (mis à jour : 8 profils),
  `profile-capabilities-*`, `permissions-catalog-sync`.
- Test dédié : `src/__tests__/phase7-d6-course-manager-profile.test.js`
  (existence, staff-only, droit unique, **être staff ne suffit pas**, super admin).
- Suite complète : voir le compte rendu de phase.

## 6. Retour arrière

Retirer l'entrée `course_manager` des deux catalogues et les deux clés i18n, et
inverser le test dédié. **Aucune donnée** : les assignations manuelles éventuelles
deviendraient orphelines (profil inconnu) — sans effet d'accès tant qu'aucune
décision ne le résout.

## 7. Points résiduels / ouverts

| Point | Nature | Destination |
|---|---|---|
| `lms.create` / `lms.delete` (créer/supprimer un cours) hors profil | Décision produit | À trancher (D6) si le gestionnaire doit les couvrir |
| Confirmation du **nom** (« Gestionnaire de cours » retenu par défaut) | Décision produit | Confirmation |
| Assignation du profil aux personnes concernées | Opérationnel | Écran People / Person Access (hors agent) |
