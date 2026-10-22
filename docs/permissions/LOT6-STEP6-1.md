# Lot 6 — étape 6.1 : profil et droits écrits ensemble

> Date : 2026-10-20. Les deux paires qui pouvaient diverger sont désormais
> atomiques, et le registre expose un contrôle de cohérence en lecture seule.

---

## 1. Les deux paires rendues atomiques

### a. Le droit et sa provenance

Un octroi de contexte écrit **deux** lignes : la capacité dans
`user_capabilities` et sa provenance dans `context_applied_grants`. Le code les
écrivait l'une après l'autre : une panne entre les deux laissait soit un accès
que personne ne peut attribuer, soit une provenance pour un accès jamais accordé.

`withContextGrantTransaction` (modèle) les regroupe. Chaque capability est
appliquée ou retirée dans **une seule transaction** :

```
upsertUserCapability + upsertContextAppliedGrant   → tout ou rien
deleteUserCapability + deleteContextAppliedGrant   → tout ou rien
```

### b. Le plan de cartes de profil

`syncContextGrantsAssignments` calcule un plan `ouvrir / redater / fermer` puis
l'applique ligne par ligne. Une panne au milieu laissait un historique à moitié
écrit (une carte ouverte pour une relation que la même passe n'a pas fermée, ou
l'inverse).

`withAssignmentTransaction` (modèle) exécute tout le plan dans **une seule
transaction** ; la moindre erreur annule l'ensemble. Le reconcile rapporte
`skipped: "error"` et ne lève jamais.

---

## 2. Frontière assumée

Les deux paires sont atomiques **chacune**, pas l'une avec l'autre : les droits
sont écrits avant les cartes. Un échec du plan de cartes après l'écriture des
droits laisse donc un état transitoire, qui est :

- **rapporté** (`profileAssignments.skipped === "error"`,
  `result.success === false`) — jamais silencieux ;
- **résorbé** par le balayage planifié, qui re-dérive depuis l'affectation ;
- **visible** dans le contrôle de cohérence ci-dessous.

Faire des deux paires une seule transaction demanderait de faire traverser le
client transactionnel aux lectures de la phase F (lecture résiduelle), qui
lisent les cartes fermées à l'étape précédente. C'est un découpage plus large,
laissé au backlog, et non un choix silencieux.

---

## 3. Contrôle de cohérence (lecture seule, ne corrige jamais)

`listProfileAssignmentConsistency()` (modèle) répond, par clé de profil :

| Colonne | Signification |
|---|---|
| `active_cards` | cartes actives qui pointent sur ce profil |
| `profile_without_rights` | cartes dont le profil est absent ou inactif |
| `profile_without_capabilities` | cartes dont le profil n'a **aucune** capacité |

Il est exposé par le rapport de préparation existant
(`GET /api/engineering/permissions/context-grant-readiness`) sous
`profile_consistency` :

```json
{
  "known": true,
  "broken": 0,
  "profiles": [
    { "profileKey": "venture_member", "activeCards": 1,
      "profileWithoutRights": 0, "profileWithoutCapabilities": 0 }
  ]
}
```

`broken` est aussi repris dans `summary.profileConsistency`. Une lecture en échec
donne `known: false` — jamais « propre ». La direction inverse (« droits sans
carte ») est le `driftToAdd` / `driftToRemove` déjà rapporté par personne.

---

## 4. Tests

- `profile-assignment-automatic-phase-e` — deux tests ajoutés :
  - **la provenance échoue** → la capacité écrite avant est annulée
    (`user_caps` vide, `success: false`) ;
  - **la fermeture échoue** → la carte ouverte juste avant est annulée, et la
    carte précédente reste la seule active.
- Le faux `db` de ce fichier implémente `transaction` comme le vrai : instantané
  de l'état, restauration sur erreur.
- `phase6-context-grants` et `helpers/programAssignmentGrants` : leur faux `db`
  reçoit `transaction` (le délégué à `execute`), sinon la paire échouait.
- Suites ciblées : 10 suites / **3 063 tests verts** (rapport de préparation,
  admin permissions, bornes de couches, réconciles programme/facilitateur).
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 5. Compteurs

Aucun compteur de dette ne bouge dans ce lot (il ne supprime pas une porte) :

| Indicateur | Valeur |
|---|---:|
| Actions en dette | 60 |
| Liste de travail | 125 |
| Ancien contrôle venture | 0 |
| Contrôle venture complet | 112 |

---

## 6. Retour arrière

`git revert`. Aucune migration, aucune écriture en base.

---

## 7. Compte rendu

```
LOT 6 — Profil et droits écrits ensemble — étape 6.1
Fait :
  - la paire capacité/provenance est atomique (apply et revoke)
  - le plan de cartes de profil est atomique (ouvrir/redater/fermer)
  - un contrôle de cohérence en lecture seule est exposé au rapport
  - deux tests de rollback ajoutés
Compteurs : inchangés (60 dette, 125 liste de travail)
Divergences : la frontière entre les deux paires est documentée (rapportée,
  résorbée par le balayage, visible dans le contrôle).
Tests ajoutés / passants : 2 tests de rollback + 3 063 tests ciblés + 54 authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : Lot 7 — une seule projection pour l'interface.
```
