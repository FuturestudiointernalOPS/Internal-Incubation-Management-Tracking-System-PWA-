# Phase 7 — D3 (2/2) : révocation de la trace historique

> Décision **D3** (option c) — `phase-1-decisions.md`. Spec §10.3, §16.3.
> La trace historique est **révocable** par un administrateur. La moitié
> « expiration » est le lot **1/2** (`phase-7-d3-historical-retention.md`).

## Ce qui change (code)

| Fichier | Rôle |
|---|---|
| `src/models/authorization/historicalAccessRevocationsStore.js` (**nouveau**) | table `historical_access_revocations` (auto-guérison, comme `profile_assignments`) : **une ligne par (personne, contexte)** |
| `src/services/authorization/contextGrantHistory.js` | le réconciliateur **consulte le registre** : une révocation → **aucun résidu dérivé**, et le résidu déjà écrit est **retiré** (via la provenance, donc borné au sentinelle `hist:`) |
| `src/services/authorization/historicalAccessAdmin.js` (**nouveau**, service) | cas d'usage : enregistrer → réconcilier (retirer / ré-appliquer) → auditer → invalider le contexte en cache |
| `src/app/api/engineering/permissions/historical-access/route.js` (**nouveau**) | `GET` (`permissions.view_matrix`) liste ; `POST` / `DELETE` (`permissions.revoke`) révoquent / restaurent |

## Décisions de conception

- **Granularité = (personne, contexte)** : « retirer la vue historique
  *programmes* / *ventures* ». C'est l'unité du résidu dérivé.
- **Persistance obligatoire** : le balayage **re-dérive** le résidu à chaque
  passe ; une simple suppression serait **ré-appliquée**. Le registre est donc la
  source de vérité de la révocation.
- **L'historique relationnel n'est JAMAIS touché** (§13, pas de suppression de
  trace) : seul le **résidu dérivé** (lecture seule) est retiré.
- **Réversible** : `DELETE` supprime le registre et **ré-applique** le résidu si
  la relation est toujours terminée.
- **Titulaire** : `permissions.revoke` (défaut : super admin), conformément à
  l'arbitrage D3.

## Preuves (exécutées)

- `src/__tests__/phase7-d3-revocation.test.js` (10) : service (enregistrement,
  refus d'un contexte non révocable, restauration, lecture) + API (garde 403,
  400 contexte invalide / sans cid, 200 révocable, GET, DELETE).
- `src/__tests__/profile-history-phase-f.test.js` : **+2** — une révocation
  **retire** le résidu et **bloque sa ré-application** ; contrôle sans révocation.
- Suite complète : **406 suites / 7576 tests**, 0 échec. Lint : 0 erreur.

## Écran de retrait (UI)

Le panneau de portée d'une personne (`PersonScopePanel`, écran **Personnes**)
liste, pour chaque **contexte historique retenu** (programme / venture), l'action
**Retirer** — ou **Rétablir** quand le contexte est déjà révoqué (badge « retiré »).
Le clic passe par `useDialogs` (confirmation, ton `danger` à la révocation), appelle
l'API puis rafraîchit la portée. Sans personne sélectionnée, le panneau reste en
lecture seule. PeopleView transmet l'identifiant de la personne.

## Reste / suite

- **Rien de bloquant** pour D3. La table est créée par **auto-guérison** à la
  première utilisation — **aucun accès base** n'a été pris pendant ce lot ; à
  vérifier en préproduction.
- Vérifier en préproduction que l'écran reflète bien l'état après révocation
  (le compteur de portée `*_managed_history` reste, car il découle de la relation
  terminée — c'est le **badge retiré** et le bouton Rétablir qui portent l'état).
