# Mesure — un appel gardé compté comme non gardé

> Date : 2026-10-20. Correction du tableau de bord, pas du code applicatif.

## Le fait

Le tableau annonçait **31 / 32** appels de périmètre programme vérifiant aussi la
capacité. Le 32ᵉ existe et vérifie bien la capacité :

```js
// src/app/api/team-tasks/route.js
return requireProgramScope({
  programId: verdict.programId,
  wave: "groups",
  module,
  capability,
});
```

`module` et `capability` y sont des **propriétés abrégées** (même objet, même
décision, autre orthographe). Le scan cherchait `module:` et `capability:` avec
les deux-points, donc il ne voyait ni l'un ni l'autre.

## La correction

`namesCapability(snippet)` reconnaît les deux formes :

| Forme | Exemple |
|---|---|
| clés explicites | `module: "programs", capability: "edit"` |
| propriétés abrégées | `module, capability` |

La même fonction sert au compteur de périmètre et au détecteur « cette route
porte une décision de capacité », pour que les deux ne puissent pas diverger.

## Résultat

| Indicateur | Avant | Après |
|---|---:|---:|
| Appels de périmètre programme | 32 | 32 |
| dont vérifiant aussi la capacité | 31 | **32** |

Aucun fichier applicatif n'est modifié. Le cliquet reste respecté (couverture en
hausse).

**À retenir** : un compteur littéral peut se tromper dans les deux sens. Le
tableau disait « un trou » là où il n'y en avait pas ; c'est la mesure qui a été
corrigée, et la vérification manuelle du seul appel signalé qui a tranché.
