# Phase 7 — D1 (a) : la lecture historique est BORNÉE

> Décision **D1** — `phase-1-decisions.md` (spec §10.1–10.4, §16.3) : la lecture
> d'un ancien gestionnaire est une **règle distincte**, **en consultation seule**,
> **bornée** au programme/venture dont la personne a été manager.
> Ce lot traite la **borne de portée** (option a) ; le contenu détaillé
> (participants/documents/rapports) est l'option (b), à confirmer.

## Problème constaté (faits vérifiés)

1. Le résidu écrit un **vrai** `programs.view` (`granted_by = 'hist:...'`) : au
   niveau d'une route, il était **indistinguable** d'un droit réel.
2. La route `/api/programs` gouvernait le répertoire par la **seule capacité** →
   un ancien gestionnaire (résidu `programs.view`) listait **tout le répertoire**
   (sur-lecture).
3. Les politiques `program_managed_history` / `venture_managed_history` n'étaient
   consultées par **aucune route de lecture** (seul l'outil de diagnostic).

## Correctif

| Fichier | Rôle |
|---|---|
| `src/services/authorization/historicalReadScope.js` (**nouveau**) | `readIsHistoricalOnly(cid, feature)` : vrai **ssi toutes** les lignes vivantes du droit de lecture viennent du résidu (`hist:`). Un droit réel (profil, groupe, individuel) → **faux** (accès normal). Échec de lecture, ligne absente ou date illisible → **faux** (neutre — ne borne jamais à tort). `historicalContextIdsForFeature` : les anciens contextes (portée historique). |
| `src/app/api/programs/route.js` | Un **lecteur historique seul** est **borné** à ses anciens programmes ; `?id=` hors de son historique → **403**. Un rôle de gestion (`super_admin`/`program_manager`) garde le répertoire. |
| `src/services/programs/programV2.js` | `getV2ProgramDirectory` accepte `programIds` (bornage). |

## Effet / direction

**RÉTRÉCISSEMENT** : l'ancien gestionnaire ne consulte plus que les programmes
qu'il a gérés, **jamais le répertoire**. Aucun élargissement ; un détenteur réel
change de rien. Le résidu reste **lecture seule** (`view`, niveau 1).

## Preuves (exécutées)

- `phase7-d1-historical-read-scope.test.js` (8) : distinction résidu/droit réel
  (dont expiré, vide, coexistants), résolution des contextes, bornage du
  répertoire.
- `phase7-d1-programs-directory-bound.test.js` (4) : route — borné, refus hors
  historique, détenteur réel inchangé, rôle de gestion.
- Suite complète : **409 suites / 7594 tests**, 0 échec. Lint : 0 erreur.

## Reste / suite

- **Ventures** : le répertoire borne **déjà** par rôle (staff/pm = affectations ;
  membres = adhésion) → **pas de sur-lecture** côté venture ; aligner la lecture
  historique des ventures (voir leurs anciennes ventures) reste à faire.
- **Contenu (option b)** : participants / documents / rapports — à confirmer par
  le produit avant tout élargissement.
- À **mesurer en préproduction** (aucun accès base pris dans ce lot).
