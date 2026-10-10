# Phase 4 — Clôture : renforcer le moteur central

> Clôture formelle de la Phase 4. **Aucune migration, aucune donnée, aucune
> configuration modifiée** pendant cette phase. Tout changement est du **code**,
> réversible, couvert par des tests.
> Résultat : **383 suites / 7411 tests verts**, lint **0**.

## 1. Objectif et critère de sortie (protocole)

**Objectif** : le moteur devient l'unique juge ; il applique lui-même les règles
de la spec (§11, §13).

**Critère de sortie du protocole** :
1. le moteur expose **une seule API** ;
2. les scénarios §15 « éligible sans permission », « feature non éligible », « manager de A modifie B », « expiration » passent ;
3. les décisions ne dépendent **plus d'un recalcul** pour être correctes.

### Verdict honnête : **critère partiellement atteint**

- (2) **Atteint** : les **13 scénarios §15** passent (Phase 2).
- (3) **Atteint pour l'essentiel** : les lectures filtrent directement les dates (`ends_at`, `status`) et la borne de **début** a été ajoutée (`PERIOD-START-1`).
- (1) **NON atteint** : il n'existe pas encore **une seule** API de décision — la **portée** reste décidée **hors du moteur** (gardes de route). C'est l'objet transféré à la **Phase 5**.

## 2. Sous-lots livrés

| Sous-lot | Objet | Fichiers principaux | Tests ajoutés |
|---|---|---|---|
| 1 | **État du compte** préalable (§11) | `contextReads.js`, `contextResolver.js`, `contextDecisions.js` | `permissions-account-state.test.js` (8) |
| 2 | **Justification** renvoyée par la décision (§11/§12.4) | `contextDecisions.js`, `contextAccess.js` | `permissions-justification.test.js` (17) |
| 3 | **Validation à l'attribution** (§5.3) + détecteur plafond-sans-droit | `permissionWrites.js`, `eligibilityAdmin.js`, `models/authorization/index.js` | `permissions-ceiling-health.test.js` (5) + admin (+2) |
| 4 | **Anti-escalade** (§13) | `app/api/engineering/permissions/route.js` | admin (+3) |
| 5 | **Réévaluation** (§5.3) | `permissionWrites.js` | admin (+2) |

## 3. Éléments **déjà en place** (vérifiés, non modifiés)

- Plafond appliqué aux **modèles de profil**, **overrides**, création de profils (avant ce lot).
- `isSelfAssignment` sur `profile-override` (Lot 8).
- Invalidation du cache pour éligibilité, profils, adhésion, affectations, octrois.
- Garde `promote_super_admin`/`remove_super_admin` réservée au super admin.

## 4. Points résiduels / ouverts (avec destination)

| Point | Nature | Destination |
|---|---|---|
| **Portée dans le moteur** (API unique plafond+droit+blocage+périmètre) | Objectif non atteint | **Phase 5** |
| **Échec fermé uniforme** (écran ferme / serveur = erreur de service) | Non traité | Phase 5 ou lot dédié |
| **Super admin exempté** de la porte du compte | Décision à rendre | décision produit |
| Plafonner l'attribution **à autrui** par le `risk` du droit | Décision produit | décision produit |
| Afficher la **raison** et l'**alerte plafond-sans-droit** dans l'écran | Interface | **Phase 9** (§12.3/§12.4) |
| `hors portée` / `expiré` non exprimables comme raison | Technique | Phase 5 |

## 5. Preuves de validation (réellement exécutées)

- Suite complète à la clôture : **383 suites / 7411 tests**, 0 échec.
- Lint : **0 erreur / 0 avertissement** sur les fichiers touchés.
- Tests ciblés par sous-lot : 1→(9/178), 2→(6/125), 3→(7/93), 4→(4/69), 5→(5/97).

## 6. Retour arrière (par sous-lot, indépendant)

Chaque sous-lot se révoque en retirant son/ses édition(s) de code — aucune
donnée, aucune migration. Les tests ajoutés deviennent rouges si un garde-fou
est retiré (signal attendu).

## 7. Passation à la Phase 5

À traiter en Phase 5 : **amener l'inventaire A à zéro** et **intégrer la portée
dans le moteur**. Prérequis identifiés :

- **Construire le « mode ombre »** (inexistant) pour mesurer les divergences avant bascule.
- **Re-vérifier au terminal** les `fichier:ligne` des inventaires (instantané obsolète — `SNAP-1`).
- **Étendre le ratchet** des gardes statiques (`GUARD-EXT-1`).

**Réserve** : la conformité globale **n'est pas** atteinte ; voir `BACKLOG.md`.
