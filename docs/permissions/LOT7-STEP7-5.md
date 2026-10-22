# Lot 7 — étape 7.5 : les écrans lisent un prédicat nommé

> Date : 2026-10-21. Quatorze sites d'interface comparaient encore le libellé
> de rôle pour décider d'un affichage. Ils posent désormais la question par son
> nom, sans changer une seule réponse.

---

## 1. Ce qui a changé

| Écran | Avant | Après |
|---|---|---|
| Blocages (admin) | `role === "super_admin"` | `isPlatformOwnerRole(role)` |
| Investisseurs (admin) | idem | idem |
| Tableau de bord (données) | `JSON.parse(user).role === "super_admin"`, `!== "super_admin"` | `isPlatformOwnerRole` |
| Tableau de bord (widgets) | `user.role === "super_admin"` | idem |
| Rapports opérationnels | `role === "super_admin"` | idem |
| Travail (admin) | `role === "super_admin"` | idem |
| Garde du layout `/admin` | `ADMIN_ROLES.includes(role)` ×2 | `isPlatformOwnerRole(role)` |
| Annonces (admin) | liste de quatre rôles dont `"admin"` | `isInternalStaffFamilyRole(user?.role)` |
| Équipes d'un programme | même liste de quatre rôles | `isInternalStaffFamilyRole(contact.role)` |
| Grille des espaces de travail | `effectiveRole === "staff"` ou `"super_admin"` | `isInternalStaffRole` ou `isPlatformOwnerRole` |
| Groupes cibles d'un programme | `userRole === "super_admin"` | `isPlatformOwnerRole(userRole)` |
| Projets (admin) | `userRole === "super_admin"` | `isPlatformOwnerRole(userRole)` |
| Liste des personnes (centre) | helper local comparant le libellé | `isPlatformOwnerRole(person.role)` |
| Alertes du centre | filtre des fiches `super_admin` | `isPlatformOwnerRole(contact.role)` |

La liste des annonces et des équipes admettait aussi le libellé `"admin"`, qui
**n'existe dans aucun catalogue de rôles** et n'est produit par aucune connexion.
Il disparaît avec la comparaison : c'était un vestige, pas un accès.

## 2. Ce que le compteur appelle à tort une comparaison

Trois familles mesurées ne sont **pas** des rôles de plateforme :

- `member.role === "admin"` (organisations d'un investisseur) — rôle **dans
  l'organisation**, un domaine métier ;
- `contact.role === "unassigned"` (modale d'inscription) — un état de fiche ;
- `member.role === "lead"`, `project.role === "owner"`,
  `assignment.role === "group_leader"` — des rôles **de projet ou de groupe**.

Les migrer vers un prédicat de plateforme serait faux. Elles restent mesurées
et expliquées.

## 3. La règle d'interface qui n'est pas migrée

`selectVisibleTabs` montre un onglet si `tab.roles.includes(user.role)` **ou**
si la personne est gestionnaire de programme, gestionnaire assigné ou membre de
l'équipe. La composition en « ou » fait donc apparaître l'onglet Configuration
à des gens que sa liste de rôles exclut. C'est une divergence de règle, pas un
simple libellé : la corriger change ce que voit un membre d'équipe. Elle attend
une décision produit et n'est pas touchée ici.

## 4. Compteurs

| Indicateur | Avant 7.5 | Après 7.5 |
|---|---:|---:|
| Comparaisons de rôle hors moteur | 228 | **211** |
| Exceptions figées du garde-fou rôles | 146 | **137** |

Les cinq derniers sites (grille, groupes cibles, projets, liste et alertes du
centre) ne font pas bouger ces compteurs : leurs comparaisons portent sur des
variables, pas sur des littéraux, et le motif mesuré ne les voyait pas. Ils sont
migrés pour la cohérence, pas pour le chiffre.

Les autres compteurs sont inchangés : ce lot ne modifie aucune porte serveur.

## 5. Tests

- `permissions-static-guards` et `authz-metrics-ratchet` → verts ; 9 exceptions
  devenues périmées sont retirées sur le rapport du garde-fou.
- `navigation`, `ui-server-equivalence` → verts.
- `investor-application-intake` fige désormais le prédicat (`isPlatformOwnerRole`)
  au lieu du libellé, même règle.
- `npm run test:authz` → **14 suites / 95 tests** verts.
- Balayage admin/tableau de bord/navigation → 36 suites vertes ; le seul échec
  est préexistant (`journey-delete-super-admin`).
- Balayage espaces/projets/centre de permissions → **27 suites vertes**.
- `npm run lint` → 0 erreur.

## 6. Retour arrière

`git revert`. Aucune écriture en base, aucun changement de règle.

## 7. Compte rendu

```
LOT 7 — Une seule projection pour l'interface — étape 7.5
Fait :
  - 14 sites d'interface posent la question par un prédicat nommé
  - le vestige de rôle « admin » (absent de tout catalogue) disparaît
  - 3 familles de comparaisons métier documentées comme hors périmètre
  - 1 règle d'onglets signalée, non corrigée (décision produit)
Compteurs : comparaisons 228 -> 211 ; exceptions 146 -> 137.
Divergences : aucune réponse ne change.
Tests : 14 suites / 95 tests authz verts ; 36 suites du balayage admin.
Décisions requises : la visibilité des onglets du programme (liste de rôles
  contredite par la composition en « ou »).
Retour arrière : git revert.
Prochaine étape : les écrans restants qui décident encore par rôle, puis les
  routes mortes du Lot 8.
```
