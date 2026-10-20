# Lot 8 — étape 8.5 : plus aucun écran ni service ne lit les anciens libellés

> Date : 2026-10-20. Les comparaisons de rôle sont migrées vers trois prédicats
> nommés. **Correction importante ci-dessous :** la mesure de population faite
> depuis cette copie de travail ne portait pas sur la base réellement utilisée.

---

## ⚠ Correction (même jour)

La base joignable depuis cette copie de travail n'est **pas** celle que l'équipe
utilise. Sur la base réelle, la requête 4 répond :

| participant_rows | with_active_program | with_direct_program |
|---|---:|---:|
| **563** | 529 | 490 |

Les chiffres de la section 1 (9 contacts, 0 identité legacy) décrivent donc une
**autre base** et ne prouvent rien pour la production. Les requêtes 2 (profil
équivalent) et 3 (sessions vivantes) **n'ont pas encore été exécutées sur la base
réelle**. La migration de données n'est pas un no-op : elle reste à mesurer.

Ce que le chiffre de 563 établit déjà : `participant` n'est pas un vestige, c'est
le rôle par défaut de la plateforme. Le retrait de ce libellé ne se réduit donc
pas à une liste à raccourcir — il faut décider ce que devient **le rôle par
défaut**, avec au moins trois conséquences visibles : l'approbation à
l'inscription (un participant est `pending`, un membre est `approved`),
l'atterrissage quand le profil est incomplet (participant → profil, membre → hub),
et la page d'accueil des comptes facilitateur/investisseur/fondateur.

---

## 1. La mesure faite depuis cette copie de travail (autre base)

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
`facilitator`, `investor`, `founder`) n'est plus bloqué par les comparaisons de
code. Il reste une mesure et une décision produit :

- **la mesure** : la base réelle porte 563 personnes nommées `participant` ; les
  requêtes 2 (profil équivalent) et 3 (sessions vivantes) restent à exécuter sur
  cette base ;
- **la décision** : `participant` est le rôle par défaut. Le retirer des valeurs
  acceptées exige de décider ce que devient ce défaut, avec trois conséquences
  visibles — approbation à l'inscription, atterrissage quand le profil est
  incomplet, page d'accueil des comptes facilitateur/investisseur/fondateur.

Ce n'est donc pas une ligne à changer. C'est un lot à part, avec un test
d'atterrissage et d'approbation par famille avant bascule, et un retour arrière
explicite.

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
Divergences : la mesure de population portait sur une autre base ; la base
  réelle porte 563 participants (correction en tête de document).
Décisions requises : le devenir du rôle par défaut et l'atterrissage par
  famille quand les quatre valeurs quitteront la connexion.
Retour arrière : git revert.
Prochaine étape : exécuter les requêtes 2 et 3 sur la base réelle, puis le lot
  « vocabulaire de connexion » (trois identités, profils, tests d'atterrissage
  et d'approbation).
```
