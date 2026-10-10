# Backlog permissions — points en attente ou à planifier

> Document de suivi. Aucune de ces lignes n'est « faite » tant qu'elle n'est pas
> marquée ✅. Distingue **blocages** (autorisation/accès/décision) et **travaux**.
> Dernière mise à jour : Phase 3 (après correctifs `IDOR-FOUNDER-1` et `PERIOD-START-1`).

## 1. État des phases (plan d'origine)

| Phase | Objet | État |
|---|---|---|
| 0 | Cartographie + complément | ✅ Terminée |
| 1 | Décisions produit (D1–D10) | ✅ Terminée (arbitrages consignés) |
| 2 | Filet de sécurité (tests) | ✅ Terminée (4 fichiers, 52 tests) |
| 3 | Urgences de sécurité | 🟡 **Partielle** — 5/9 corrigées ; reste ci-dessous (base/config/décision) |
| 4 | Renforcer le moteur central | 🟡 **Clôturée** (sous-lots 1–5 ; critère partiel — voir `PHASE4-CLOSURE.md`) |
| 5 | Migration des contrôles par rôle + portée dans le moteur | ⬜ **Prochaine** |
| 6 | Couverture des actions | ⬜ À planifier |
| 7 | Implémentation des décisions produit | ⬜ À planifier |
| 8 | Affectations et identité | 🟡 **Partielle** — tâche 3 (compatibilité rôle ↔ profil sur les chemins manuels) faite ; le reste (migrations, déclencheurs) à planifier |
| 9 | Administration et vocabulaire | ⬜ À planifier |
| 10 | Vérification finale (arrêt humain) | ⬜ À planifier |

## 2. Sécurité — points restants

| ID | Priorité | État | Blocage | Action attendue |
|---|---|---|---|---|
| `IDOR-FOUNDER-1` | P1 | ✅ Corrigé (code + test) | — | — |
| `PERIOD-START-1` | P2 | ✅ Corrigé (code + test) | — | — |
| `SECRET-1` (contacts) | P1 | 🟡 Code déployé (rehash-on-login) — **migration en masse NON exécutée** | **Accès base** + snapshot | Lancer `node scripts/hash-legacy-passwords.mjs --apply --backup=…` sur un hôte base, puis vérifier `0` |
| `SECRET-1` (mots de passe partagés « famille ») | P1 | ⬜ Ouvert | Table différente + décision | Décider + migration dédiée (hachage des `shared_password_*`) |
| `SECRET-3` (mots de passe équipe/groupe) | P2 | ⬜ Ouvert | Table différente + décision | Décider + migration dédiée |
| `UPLOAD-1` (stockage public) | P1 | ⬜ Ouvert | **Configuration** (buckets privés + liens signés) | Autoriser la modif de config Supabase + adapter les URL |
| `BOLA-FORM-1` (domaine runs global) | P1 | ⬜ Ouvert | **Décision produit** | Rattacher chaque exécution à un programme **ou** réserver aux propriétaires |
| `LOGIC-INV-1` (investisseur auto-déclaré) | P2 | ⬜ À reproduire | **Décision produit** | Confirmation staff requise pour le statut « invested » |
| `PROTECT-RESPOND-1` (`/api/respond`) | P2 | ✅ Corrigé (limitation de débit, clé IP) | — | — |
| `PROTECT-DRAFT-1` (`/api/s/public-draft`) | P2 | ✅ Corrigé (jeton + slug + limitation de débit à la création) | — | — |
| `AUTH-ENUM-SESSIONLOGIN-1` | P2 | ✅ Corrigé (égalisation de temps + message unique sur `session-login`) | — | — |
| `HUB-FORMRUNS-SUBMIT-1` | P3 | ⬜ À trancher | Décision | Confirmer l'intention de la sous-action `submit` |
| `DEP-1` (`tar` via `unpdf → canvas`) | P3 | ⬜ Indéterminable | Réseau | Lancer `npm audit --json` (sans `--fix`) |

## 3. Décisions produit D1–D10 — implémentation restante

Les décisions sont **arbitrées** (voir `phase-1-synthese.md`) ; ce qui suit est l'**implémentation**, pas l'arbitrage.

| # | Décision retenue | Implémenté ? | Phase cible |
|---|---|---|---|
| D4 | Union : un profil éligible ouvre la section malgré le refus du rôle, **avertissement de section** | ⬜ Non (le code applique « le refus explicite l'emporte ») | 4 → 7 |
| D10 | Blocage = **droit en entier** | ✅ Conforme au code (rien à changer) | — |
| D7 | **Retirer** les 6 droits d'animation non consultés ; `reviews.submit` conservé | ⬜ Non | 7 |
| D9 | **Retirer** la portée « équipe » du vocabulaire | ⬜ Non | 7 |
| D6 | Droit unique de gestion des cours via un **profil dédié** | ⬜ Non | 7 |
| D5 / D8 | Portée = **programme(s) assigné(s)** ; fin du « tout le portefeuille » par défaut | ⬜ Non | 5 → 7 |
| D1 | Lecture historique **en consultation seule**, participants inclus, programme **et** venture | ⬜ Non | 7 |
| D2 | Départ/désactivation → **perte des droits**, historique conserve sans accès | 🟡 Partiel — **porte du compte** implémentée (sous-lot 1) ; la partie « lecture historique » reste | 4 → 7 |
| D3 | Trace **révocable** + **durée configurable** (défaut 6 mois), par le super admin | ⬜ Non | 7 |

### Points résiduels **acceptés tels quels** (aucune action bloquante)
- **D6** — nom du profil : défaut retenu « Gestionnaire de cours ».
- **D7** — portée « tout droit avec manage » **hors animation** : **reportée** (les 3 droits vivants : `engineering.manage_errors`, `org_membership.manage`, `crm.manage` — non concernés).
- **D8** — sous-questions (lecture du catalogue par un responsable, séquencement, multi-programmes).
- **D3** — titulaire du droit de révocation : défaut super admin.

## 4. Dette technique / gardes

| ID | Objet | État |
|---|---|---|
| `GUARD-EXT-1` | Étendre le ratchet des gardes statiques (M1–M4) aux **5 mécanismes restants** : `const ROLE`, `ROLE_ACCESS`, `PERSONAL_ROLES`, `role_capabilities`, `requireVentureAccess` | ✅ **Fait** — `permissions-role-gates-extended.test.js` + liste d'exceptions **classée** (26 décisions, 25 masques), généré par `scratch/gen-role-gate-ext.mjs` |
| `PROFILE-ROLE-1` | Compatibilité rôle ↔ profil (§3.3) sur les **deux chemins manuels** qui l'ignoraient : registre `profile_assignments` + override par personne | ✅ **Fait** — `profileRoleAssignmentGate` (`services/authorization/profileCatalog.js`) appliqué aux deux routes, **409** + `profile_role_gap` ; tests : `profile-assignments-phase-c.test.js`, `profile-override-api.test.js` |
| `TRIGGER-INLINE-1` | Déclencheurs automatiques (§8.2) : PARTICIPANT et LEARNER n'avaient **aucun appel inline** (résolus au reconcile de connexion / balayage) | ✅ **Fait (partiel)** — reconcile inline best-effort après acceptation/retrait d'un programme et inscription LMS ; la **transaction unique** avec la relation métier reste ouverte ; tests : `phase8-automatic-triggers.test.js` |
| `ROLE-AUDIT-1` | Historique des changements de rôle global (§12.1) : le chemin `PUT /api/contacts` écrivait `role` sans **aucune** entrée d'audit | ✅ **Fait** — `recordRoleChangeAudit` (même forme que le Permission Center) sur un vrai changement ; tests : `contacts-role-audit.test.js` |
| `SNAP-1` | Divergence outils↔disque : les `fichier:ligne` des inventaires A/C/D/G doivent être **revérifiés au terminal** avant toute correction | ✅ **Fait** — comptages confirmés au terminal (83/108/219/81/21/10/3/1/40 ; seul M3 : 218→219) — voir `inventaire-00-cartographie.md` §8.1 |
| `SPEC-1` | Scénarios §15 testés au niveau **service/pur**, pas bout-en-bout HTTP | ⬜ Approfondir si nécessaire |
| `REFS-1` | Le libellé « corrompu » de la Phase 0 n'existe pas sur le disque (instantané obsolète) — constat **retiré** | ✅ Traité |

## 5. Tâches opérationnelles (à exécuter par un humain, hors agent)

1. **Snapshot** de la base de production **avant** toute migration.
2. **Migration des mots de passe** : `node scripts/hash-legacy-passwords.mjs --apply --backup=/secure/pw.tsv` — puis vérifier `0` ligne héritée, puis sécuriser/supprimer la sauvegarde.
3. **`npm audit`** (lecture seule) pour statuer sur `DEP-1`.
4. **Relevé des identités héritées** sur une copie hors production (`contacts.role`), pour confirmer le nettoyage d'identité.

## 6. Éléments reportés à la Phase 4 (moteur central)

Objectif (spec §11) : **une seule décision, au même endroit, côté serveur**, avec refus par défaut et justification vérifiable.

- Période de validité vérifiée **directement** à la décision (partiellement fait : `started_at` ajouté) — auditer le reste.
- **Portée dans le moteur** : une fonction unique appliquant plafond + droit + blocage + **périmètre** (aujourd'hui la portée est réécrite hors moteur).
- **Échec fermé uniforme** (écran / serveur).
- **Validation à l'attribution** (§5.3) — ✅ **fait (sous-lot 3)** : interdiction d'accorder un droit sur une section non éligible, étendue au **droit individuel**, au **défaut de rôle** et au **défaut de groupe** (`permissionWrites`) ; les modèles/overrides l'avaient déjà. **Détecteur** « plafond ouvert sans droit » ajouté (`findOpenCeilingsWithoutRights`, pur).
  - **Reste** : la **surface d'alerte** (afficher ce détecteur dans l'écran d'éligibilité, §12.3) — phase d'interface (9).
- **État du compte** comme préalable (§11) — ✅ **fait (sous-lot 1)** : `authorize` refuse un compte non `active` avant éligibilité/capacité ; `accountStatus` exposé par le contexte ; statut inconnu = comportement inchangé ; **super admin exempt** (voir le point ouvert ci-dessous).
- **Point ouvert (sous-lot 1)** : le **super admin** reste exempté de la porte du compte. À trancher : un super admin désactivé/suspendu avec une session vivante doit-il être refusé lui aussi (spec §11) ?
- **Justification** renvoyée par la décision — ✅ **fait (sous-lot 2)** : `explainAuthorization(ctx, module, capability, minLevel) → { allowed, reason }` (enum) ; `authorize` délègue ; `evaluateAuthorization` journalise et renvoie la raison réelle. Raisons : `invalid_input`, `super_admin`, `granted`, `account_not_active`, `not_eligible`, `blocked`, `missing_permission`, `insufficient_level` (+ `unauthenticated` / `system_failure` côté route).
  - **Non couvert par ce lot** : `hors portée` et `expiré` — le périmètre est décidé hors du moteur (Phase 5) ; l'expiration est traitée en amont par les lectures (les droits expirés n'apparaissent pas), donc pas encore de raison dédiée.
- **Anti-escalade** (§13) — ✅ **fait (sous-lot 4, partiel)** : nul ne modifie **ses propres** droits via la route d'administration (garde `isSelfAssignment` sur grant / revoke / restrict / unrestrict / set_role / set_status) ; **seul un super admin** peut attribuer le rôle `super_admin` via `set_role` (cela ferme le contournement de la garde `promote_super_admin`).
  - **Reste à trancher (décision produit)** : un gestionnaire délégué peut-il attribuer à **autrui** un droit plus puissant que ceux qu'il détient (plafonner par le `risk` du droit) ? Non implémenté.
- **Réévaluation** à la modification d'éligibilité/modèle/affectation — ✅ **fait (sous-lot 5)** : éligibilité, modèles de profil, profils et adhésion invalidaient déjà **tous** les contextes ; les **défauts de rôle/groupe** n'invalidaient que la cible → ils invalident désormais **tous** les contextes (`invalidateAllAuthorizationContexts`). Un octroi individuel ne réévalue que la cible.

---

**Réserve** : la conformité globale **n'est pas** atteinte ; ce backlog en est la liste ouverte.

---

## 8. Phase 5 — prérequis et tranches

| Étape | Objet | État |
|---|---|---|
| a | `SNAP-1` (re-vérif. terminal) + `GUARD-EXT-1` (ratchet M5–M9) | ✅ |
| b | **Mode ombre** (`services/authorization/shadow.js`, inert, flag `AUTHZ_SHADOW_MODE`) | ✅ |
| c1 | **Raisons** de la décision scoped (`evaluateScopedAccess` : missing_resource / unauthenticated / super_admin / capacité / out_of_scope / granted / system_failure) | ✅ |
| c2 | Point d'entrée **unique** `decide(...)` (comportement inchangé) | ✅ — `decide` (global ou scopé) ; `evaluateScopedAccess` **délègue**. **Convergence partielle assumée** : `evaluateAuthorization` reste la **primitive de capacité** que `decide` compose (le faire déléguer casserait le contrat de moquage de tests existants). |
| c3a | **Mode ombre sur la portée** (dans `decide` : `isWithinScope` vs ad-hoc, sans changer l'issue) | ✅ |
| c3b | **Bascule mesurée** de la portée vers le moteur | ⬜ **gated ops** : activer `AUTHZ_SHADOW_MODE=1` en staging, collecter les divergences, les analyser, puis basculer |
| c3c | **Lots de migration** de l'inventaire A (10–20 contrôles/lot) | ⬜ **gated ops** : mesure ombre par lot avant bascule |
