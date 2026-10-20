# Lot 8 — étape 8.5 : plus aucun écran ni service ne lit les anciens libellés

> Date : 2026-10-20. La production est confirmée comme cible et ne contient
> **aucune** identité contextuelle legacy. Le blocage restant n'était donc plus
> dans les données mais dans le code : 21 lignes comparaient encore les quatre
> anciens noms. Elles sont migrées.

---

## 1. La mesure sur la production

La base cible est celle que l'application sert réellement. Mesure en lecture
seule, sans écrire :

| Valeur stockée | Contacts |
|---|---:|
| `staff` (actif) | 4 |
| `applicant` | 3 |
| `member` | 2 |
| `super_admin` (actif) | 1 |

- **0** personne ne porte `participant`, `facilitator`, `investor` ou `founder`.
- **0** session vivante ne porte l'un de ces noms.
- Total : 9 contacts.

Conséquence : **la migration de données est un no-op**. Il n'y a personne à
doter d'une affectation équivalente. Le travail restant est le retrait des
libellés dans le code, pas une correction de base.

> Écart documenté : la note du projet décrivait 588 contacts sur cette même
> base. La base répond aujourd'hui 9 contacts. Les deux ne peuvent pas être
> vrais ; on retient la mesure, pas la note.

## 2. Ce qui a été migré

Deux notions nouvelles dans la couche d'identité, pour ne pas confondre deux
familles proches :

| Fonction | Famille | Exemple |
|---|---|---|
| `isMemberSurfaceRole` | **coque** personnelle : `participant`, `member`, `founder` | « cette personne vit dans l'espace personnel » |
| `isMemberIdentityRole` | **identité** membre : `member` + le libellé legacy `participant` | « cette personne agit sur son propre dossier » |
| `isInternalStaffFamilyRole` | **famille staff** : propriétaire de la plateforme, personnel, legacy `program_manager` | « cette personne voit tout » |

La distinction compte : un **fondateur** partage la coque personnelle mais n'est
pas une identité membre — il ne doit pas devenir « participant » par simple
voisinage dans une barre latérale.

| Site | Ancienne règle | Nouvelle règle |
|---|---|---|
| calendrier — portée venture | tableau de trois rôles | `isInternalStaffFamilyRole` |
| calendrier — visibilité des relances | `role === "participant"` | `isMemberSurfaceRole` |
| relances (lecture) | idem + `!== "super_admin"` | idem + `isPlatformOwnerRole` |
| historique des courriels d'un contact | `participant` ou `founder` | `isMemberSurfaceRole` |
| historique d'un contact (service) | idem | `isMemberSurfaceRole` |
| création d'une soumission | `participant`/`member`, puis `["participant","team"]` | `isMemberIdentityRole` + `team` |
| gestion de programme (soumissions) | tableau de trois rôles | `isInternalStaffFamilyRole` |
| sélecteur de personnel (projet, fiche contact) | `!== "participant"` | `carriesContextualValue(..., "participant")` |
| drapeau « est participant » du registre | inscription **ou** libellé | inscription seulement |
| modale d'inscription massive | idem | drapeau seulement |
| libellé de contexte venture | `role === "founder"` | `carriesContextualValue` |
| équipe programme — conflit participant | `role === "participant"` | `carriesContextualValue` |
| candidats facilitateur | trois comparaisons en chaîne | une règle nommée |

### Les deux sites qui changeaient réellement un droit

1. **Documents d'une venture.** « Un investisseur ne voit que les documents
   partagés » lisait le libellé. La règle lit maintenant le **contexte
   investisseur approuvé** (et conserve le libellé legacy comme raccourci).
2. **Verrou de notation des soumissions.** Le verrou oppose le camp
   « facilitateur » au camp « gestion ». Le camp venait du libellé ; il vient
   maintenant du **profil** (`isFacilitatorProfileSession`, ajouté à côté du
   prédicat gestionnaire). Le verrou continue de lire les valeurs déjà stockées
   sur les décisions passées, qui sont des noms de camp, pas des identités.

### Les resserrements, assumés

- Une identité personnelle (`member`, y compris legacy) ne lit que **son**
  historique de courriels et de relances, et ne soumet que **pour elle-même**.
  Avant, un `member` sans libellé `participant` tombait dans la branche « staff »
  et pouvait voir les relances historiques non attribuées.
- Une soumission vers un programme terminé est refusée à toute identité
  personnelle, pas seulement au libellé `participant`.

Aucun de ces resserrements ne touche quelqu'un en production : la population
concernée est vide.

## 3. Compteurs

| Indicateur | Avant 8.5 | Après 8.5 |
|---|---:|---:|
| Comparaisons de rôle hors moteur | 294 | **263** |
| Exceptions figées du garde-fou rôles | 182 | **169** |
| Exceptions figées du garde-fou étendu | 21 | 21 |
| Actions en dette | 56 | 56 |
| Listes de rôles en dur dans les actions | 68 | 68 |

## 4. Tests

- `permissions-static-guards` et `permissions-role-gates-extended` : verts (13
  entrées périmées retirées sur le rapport du garde-fou, jamais devinées).
- `npm run test:authz` → **11 suites / 74 tests** verts ; cliquet respecté.
- Balayage large (soumissions, calendrier, contacts, documents, équipes,
  participant, registre) : **7 863 tests verts**. Les **17 suites en échec** sont
  exactement les préexistantes (vérifiées sur `HEAD` propre).
- `npm run lint` → 0 erreur, 261 avertissements (inchangés).

## 5. Ce qui reste, et pourquoi je m'arrête là

Le retrait des quatre valeurs **de la connexion** (`participant`,
`facilitator`, `investor`, `founder`) n'est plus bloqué par les données ni par
les comparaisons de code. Il reste une conséquence produit à valider :

> une personne dont le compte porte encore `facilitator` **atterrirait sur
> l'espace personnel** (`/participant`) au lieu de l'espace facilitateur. Ses
> droits de livraison viendraient du profil, mais sa page d'accueil changerait.

Aujourd'hui, personne n'est concerné en production. La décision porte donc sur
les **futurs comptes** de ces trois familles et sur le retour arrière. C'est une
décision produit, pas technique — et elle mérite son propre lot, avec un test
d'atterrissage par famille avant bascule.

## 6. Retour arrière

`git revert`. Aucune écriture en base. Les anciens libellés restent acceptés à la
connexion : rien de ce lot ne les supprime.

## 7. Compte rendu

```
LOT 8 — Plus aucun code ne lit les anciens libellés — étape 8.5
Fait :
  - production confirmée : 0 identité legacy, 0 session legacy
  - 21 comparaisons migrées vers trois prédicats nommés
  - visibilité investisseur lue sur le contexte approuvé
  - verrou de notation lu sur le profil facilitateur
Compteurs : comparaisons 294 -> 263 ; exceptions 182 -> 169.
Divergences : deux resserrements (historique personnel, soumission vers un
  programme terminé), sans effet sur la population actuelle.
Tests : 11 suites / 74 tests authz, 7 863 tests au total, 17 suites
  préexistantes en échec. Lint 0 erreur.
Décisions requises : l'atterrissage d'un compte legacy facilitateur/investisseur/
  fondateur quand les quatre valeurs quitteront la connexion.
Retour arrière : git revert.
Prochaine étape : lot « vocabulaire de connexion » — trois identités, profils,
  test d'atterrissage par famille.
```
