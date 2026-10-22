# Lot 7 — étape 7.1 : une seule projection, et la preuve d'équivalence

> Date : 2026-10-20. Le serveur expose désormais **sa propre décision** à
> l'interface (capacité + raison), et un test d'équivalence prouve que ce que la
> barre latérale affiche est toujours ce que le serveur accepte.

---

## 1. La projection serveur

`GET /api/me/permissions` renvoyait `effective` (la matrice). Il renvoie
maintenant aussi `decisions` :

```json
{
  "success": true,
  "role": "staff",
  "isSuperAdmin": false,
  "effective": { "programs": { "view": 1, "edit": 3 } },
  "decisions": {
    "programs": {
      "view":   { "allowed": true,  "reason": "granted" },
      "delete": { "allowed": false, "reason": "missing_permission" }
    }
  }
}
```

`decisions` est produit par `buildContextDecisions(ctx)` — la **même** fonction
pure que le Permission Center et le résolveur. L'écran n'a donc plus à
re-dériver une règle à partir du rôle : il lit le verdict et sa raison. La route
reste auto-scopée et n'est **jamais** une frontière de sécurité ; chaque API
redécide.

---

## 2. Le test d'équivalence

`src/__tests__/ui-server-equivalence.test.js` exécute la **vraie** projection
(`buildAccessNav`) contre la **vraie** décision (`explainAuthorization`) pour six
familles de profils :

| Profil | Rôle de session | Capacités |
|---|---|---|
| propriétaire de la plateforme | `super_admin` | toute la matrice |
| personnel interne | `staff` | Staff Default |
| gestionnaire de programme | `staff` | profil `program_manager` |
| facilitateur | `member` | bloc `facilitator` |
| participant | `member` | `projects.view`, `messaging.*` |
| membre sans affectation | `member` | aucune |

Pour chaque profil, **tout nœud rendu qui porte une exigence de capacité** est
passé à la décision serveur : elle doit être `allowed`. C'est la direction qui
compte — l'interface ne montre jamais une porte que le serveur refuse.

Le test verrouille aussi :

- le propriétaire rend bien toutes les sections majeures ;
- une capacité absente **cache** le nœud au lieu de produire un lien vers un 403 ;
- la décision renvoyée pour une capacité est cohérente avec la matrice dont elle
  dérive.

La visibilité reste **curatée** : un masque de rôle peut cacher un nœud autorisé
(choix produit), jamais l'inverse.

---

## 3. Ce qui reste (honnêtement)

Le critère « 0 règle de rôle côté interface » n'est **pas** atteint. Le compteur
`roleMotifLines` reste à **346** : la navigation est déjà projetée par capacité,
mais plusieurs écrans (tableaux de bord, messagerie, formulaires d'administration)
portent encore des branches `role === …` ou `.includes(role)`.

Prochaine étape naturelle du Lot 7 : migrer ces écrans par surface, en s'appuyant
sur `decisions` / `effective` et en étendant le test d'équivalence à chaque
surface migrée. Les composants concernés sont listés par le garde-fou
(`permissions-static-guards.test.js`, motifs M3/M4).

---

## 4. Compteurs

Aucun compteur de dette ne bouge dans cette étape (le registre d'actions n'est
pas concerné) :

| Indicateur | Valeur |
|---|---:|
| Actions en dette | 60 |
| Liste de travail | 125 |
| Comparaisons de rôle hors moteur | 346 |
| Ancien contrôle venture | 0 |

---

## 5. Tests

- `ui-server-equivalence` → **9 tests verts** (6 profils + 3 contrats).
- `navigation`, `ui5-one-dashboard`, `phase6-self-scope` → verts (59 tests avec
  le nouveau fichier).
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 6. Retour arrière

`git revert`. Aucune écriture en base.

---

## 7. Compte rendu

```
LOT 7 — Une seule projection pour l'interface — étape 7.1
Fait :
  - /api/me/permissions renvoie le verdict ET la raison par capacité
  - un test d'équivalence couvre 6 familles de profils
  - la direction « ce que l'écran montre → le serveur accepte » est verrouillée
Compteurs : inchangés (60 dette, 125 liste de travail, 346 comparaisons UI)
Divergences : le critère « 0 règle de rôle côté interface » n'est pas atteint ;
  les écrans restants sont nommés et le test d'équivalence est prêt à les couvrir.
Tests ajoutés / passants : 9 tests d'équivalence + 59 sur les suites liées.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : migrer les écrans restants par surface (messagerie, tableaux
  de bord), puis Lot 8 (chemins morts).
```
