# Phase 7 — D3 (1/2) : expiration de la trace historique

> **Nature** : changement de comportement de la **lecture résiduelle**
> (l'« historique » d'un ancien gestionnaire). Sens = **rétrécissement** : une
> lecture qui était **permanente** devient **bornée dans le temps**. Aucune
> donnée supprimée, aucune migration de schéma (le réglage de durée vit dans la
> table `system_settings` existante).

## 1. Origine — décision arbitrée

Arbitrage **D3** (voir `phase-1-decisions.md`, sections « D3 » et
« ARBITRAGE D3 — TRANCHÉE : option (c) ») : la trace historique est **révocable**
**et** **expire** selon une durée de conservation **configurable par le super
admin** (heures / jours / mois / années), **défaut 6 mois**. La trace d'audit reste
toujours conservée.

Ce lot traite la moitié **expiration**. La moitié **révocation** (écran de retrait)
reste à faire (voir §6).

## 2. État antérieur (fait de code confirmé)

`services/authorization/contextGrantHistory.js` dérivait la lecture résiduelle
(les `view` du contexte) **sans expiration** (`expiresAt: null`) : elle ne
disparaissait qu'au rétablissement de la relation ou par retrait manuel.

## 3. Ce qui change (code)

| Fichier | Rôle |
|---|---|
| `src/services/authorization/historicalAccess.js` (**nouveau**, pur) | lecture/validation de la durée, calcul de l'échéance, choix de l'ancrage |
| `src/models/authorization/historicalAccessReads.js` (**nouveau**) | lecture du réglage `system_settings.historical_access_retention` |
| `src/services/authorization/contextGrantHistory.js` | calcule et écrit `expires_at` sur la lecture résiduelle |

**Enforcement automatique** : le résolveur lit `user_capabilities` avec
`(expires_at IS NULL OR expires_at > NOW())` (`models/authorization/contextReads.js`).
Écrire l'échéance **suffit** à terminer l'accès — aucun code de décision en plus.

**Ancrage = fin de responsabilité, pas `now`** : `expiration = (dernière carte
terminée) + durée`. L'ancrage est une date **stockée**, donc **idempotent** — un
ancrage sur `now` re-daterait la ligne à chaque passage du réconciliateur.

**Format du réglage** : `system_settings.setting_value` accepte
`{"amount":6,"unit":"months"}` ou la forme compacte `"6:months"` / `"6 months"`.
Unité ∈ `hours | days | months | years`. Valeur absente ou invalide → **défaut
6 mois** (jamais « illimité » par accident).

**Changement de durée** : à la prochaine passe, la ligne est re-datée (le plan
ré-applique, ou `refreshUserCapabilityExpiry` met à jour l'échéance).

## 4. Preuves de validation (réellement exécutées)

- `profile-history-phase-f.test.js` : applique désormais une échéance
  (« end of responsibility 2026‑01‑15 » + 6 mois → `2026-07-15`) et honore un
  réglage personnalisé (`"12:days"` → +12 jours).
- `phase7-d3-historical-expiry.test.js` (**nouveau**) : lecture/validation de la
  durée (4 unités, formes JSON/compacte, repli par défaut), calcul d'échéance
  (heures/jours/mois/années, `null`), ancrage le plus récent.
- Suites liées (`permissions-spec-scenarios`, `program-assignment-grants`) : vertes.
- Suite complète : **403 suites / 7542 tests**, 0 échec. Lint : 0 erreur.

## 5. Retour arrière

Rendre `expiresAt` à `null` dans `contextGrantHistory.js` (et retirer le module
`historicalAccess`) restaure la lecture permanente. **Aucune donnée, aucune
migration** ; les échéances déjà écrites seraient à effacer par un balayage
(`UPDATE user_capabilities SET expires_at = NULL WHERE granted_by LIKE 'hist:%'`).

## 6. Points résiduels / ouverts

| Point | Nature | Destination |
|---|---|---|
| **Révocation** de la trace + **écran de retrait** (moitié « révocable » de D3) | Code + UI | Lot suivant (D3 2/2) |
| **Borne de contenu** D1 (participants/documents/rapports, programme ET venture) — les politiques `*_managed_history` restent **non appliquées** | Code | Lot D1 |
| État du compte désactivé → pas d'historique (D2) | Vérification | Déjà couvert par la **porte du compte** (Phase 4 sous-lot 1) : la décision refuse un compte non `active` avant l'éligibilité, donc avant la lecture résiduelle. À confirmer et tester explicitement dans le lot D2 |
| Assignation du réglage de durée dans une **surface d'administration** | UI | Phase 9 |
