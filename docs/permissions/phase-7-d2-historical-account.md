# Phase 7 — D2 : compte désactivé, pas d'accès historique

> Décision **D2** (arbitrage, option a) — `phase-1-decisions.md`.
> Spec §10.4, §16.4, §11.

## Décision

Si une personne voit son **compte désactivé** (départ du staff, suspension,
archivage…), elle **perd ses droits**, **y compris la vue historique**.
L'historique est **CONSERVÉ** (les enregistrements restent) mais **sans accès**.

## Ce qui l'applique

La **porte du compte** (Phase 4, sous-lot 1) : `explainAuthorization` refuse un
compte non `active` **avant** l'éligibilité et la capacité, donc avant la lecture
résiduelle. Aucun code nouveau n'est nécessaire — le comportement était en place
mais **non testé explicitement pour l'historique**.

## Preuve (exécutée)

`src/__tests__/phase7-d2-historical-account-gate.test.js` (7 tests) :

- un contexte qui **détient** le résidu (`programs.view`) est autorisé si le
  compte est `active` ;
- `inactive` / `pending` / `archived` / `suspended` → **refus** ;
- la raison renvoyée est `account_not_active` (l'historique n'est pas supprimé,
  il est **fermé**) ;
- le refus **précède** l'éligibilité et la capacité.

## Portée / limites

- Décision **pure** : aucun accès base, aucun compte réel touché.
- Ne concerne que l'**accès** : aucune suppression d'enregistrement (§13).
- Le cas « changement de rôle » (sans désactivation) n'est pas traité ici : il ne
  produit pas de perte automatique (l'arbitrage D2 lie la perte à l'état du
  compte).
