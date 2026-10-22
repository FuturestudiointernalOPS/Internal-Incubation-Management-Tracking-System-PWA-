# Lot 6 — étape 6.2 : la troisième paire, et la cohérence complétée

> Date : 2026-10-21. Le lot 6 avait rendu atomiques deux paires
> (capacité + provenance, plan de cartes). Une troisième écrivait encore deux
> tables l'une après l'autre : la responsabilité et son registre.

---

## 1. La paire « responsabilité »

Accorder une responsabilité écrit **deux** tables :

1. `user_capabilities` — le droit lui-même ;
2. `responsibility_capability_grants` — le registre qui permet de le retirer.

Écrites séparément, une panne entre les deux laisse **un droit que personne ne
peut plus révoquer** (le droit existe, le registre l'ignore). Le retrait avait le
même défaut en sens inverse : registre supprimé, droits restés.

Les deux opérations passent maintenant par **une seule transaction** :

```
grant  : droits de chaque module + leur registre   → tout ou rien
revoke : registre + les droits qu'il a créés        → tout ou rien
```

Le runner transactionnel traverse aussi les deux fonctions auxiliaires
(`trackResponsibilityGrant`, `listResponsibilityGrants`), pour qu'aucune
écriture ne sorte de la transaction.

Un test provoque l'échec de l'écriture du registre : la promesse est rejetée et
la transaction est celle qui porte le droit, donc la première écriture est
annulée.

## 2. La cohérence, sans doublon

Un contrôle existait déjà pour la paire cartes ↔ profils
(`listProfileAssignmentConsistency`) : cartes actives dont le profil manque ou
ne porte aucune capacité.

La seule direction qui manquait est **droits sans profil** : une ligne de
capacité dont la clé de profil n'existe plus. Elle est ajoutée dans un modèle
dédié, et le service de cohérence **réutilise** le contrôle existant au lieu de
le réécrire.

Le rapport est exposé par le balayage planifié déjà protégé par secret
(`POST /api/engineering/permissions/context-grants-sweep`) sous `coherence` :

```json
{
  "coherent": false,
  "brokenCards": 3,
  "profiles": [{ "profileKey": "…", "activeCards": 3,
                 "profileWithoutRights": 1, "profileWithoutCapabilities": 2 }],
  "orphanCapabilities": [{ "profile_key": "…", "capabilities": 4 }]
}
```

Il **alerte et ne corrige jamais** : une correction silencieuse masquerait le
bug qui a créé la dérive. Un test vérifie qu'aucune requête d'écriture n'est
émise.

## 3. Compteurs

Aucun compteur de dette ne bouge (ce lot ne supprime aucune porte) :

| Indicateur | Valeur |
|---|---:|
| Actions « à protéger » | 1 (assumée) |
| Liste de travail | 37 |
| Actions non déclarées | 1 |
| Comparaisons de rôle | 228 |
| Exceptions figées | 146 |

## 4. Tests

- `responsibility-grants` → 12 tests, dont le rollback du registre.
- `profile-coherence` → 4 tests : propre, cartes cassées, droits orphelins,
  aucune écriture.
- Les deux suites entrent dans `npm run test:authz`.
- `npm run test:authz` → **14 suites / 95 tests** verts.
- Balayage ciblé (responsabilités, octrois de contexte, profils, balayages) →
  32 suites vertes ; les 2 échecs sont préexistants.
- `npm run lint` → 0 erreur.

## 5. Retour arrière

`git revert`. Aucune migration, aucune écriture en base.

## 6. Compte rendu

```
LOT 6 — Profil et droits écrits ensemble — étape 6.2
Fait :
  - la paire responsabilité/droits est atomique (accorder et retirer)
  - le contrôle de cohérence couvre « droits sans profil » et réutilise
    le contrôle cartes/profils existant
  - le rapport est exposé par le balayage planifié, en lecture seule
  - un test de rollback et quatre tests de rapport
Compteurs : inchangés.
Divergences : aucune.
Tests : 14 suites / 95 tests authz verts ; 32 suites du balayage ciblé.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : Lot 7 — une seule projection pour l'interface.
```
