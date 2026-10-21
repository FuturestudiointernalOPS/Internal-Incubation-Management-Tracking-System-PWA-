# Lot 1 — étape 1.1 : un seul calcul de rôle à la connexion

> Date : 2026-10-19. Décisions validées : **D-1** (le gestionnaire de programme
> est un `staff` avec le profil `program_manager`) et **D-2** (une définition de
> « privilégié » par famille).
>
> **Suite et activation (Lot 1.3).** L'audit de couverture est propre et les 22
> contrôles de programme ont été migrés : le mode par défaut est désormais
> `staff`. Voir `docs/permissions/LOT1-STEP1-3.md`. Le §3 ci-dessous décrit
> l'état **avant** cette activation et reste comme trace de la décision.

---

## 1. Ce qui a changé

### 1.1 Un seul résolveur de rôle

Les deux chemins de connexion appellent maintenant la même fonction canonique.
Le chemin `session-login` n'a plus sa propre cascade de `if/else` : il transmet
le rôle stocké, les **groupes effectifs** (et non le simple libellé de groupe),
le `group_name` brut en secours, le drapeau équipe/famille et le drapeau legacy
`sa`. Le chemin `login` transmet désormais les mêmes entrées, y compris le
`group_name` de secours, pour que les deux réponses coïncident aussi quand la
liste des groupes effectifs est indisponible.

### 1.2 D-1 est réversible

Le résolveur canonique transforme `program_manager` en `staff` **quand la
bascule est activée** :

```bash
AUTHZ_PM_IDENTITY=staff
```

Sans cette variable, le mode par défaut garde le rôle historique
`program_manager`. Pourquoi : plusieurs contrôles lisent encore le libellé de
rôle sans contexte (`hasProgramManagementAccess(role)` dans les tâches, les
soumissions, les équipes, etc.). Les basculer d'un coup ferait perdre aux
gestionnaires de programme des surfaces qu'ils ont aujourd'hui. Ces contrôles
sont l'objet du Lot 1.3.

La bascule est donc un **drapeau de déploiement**, pas une seconde règle : à
l'intérieur d'un mode donné, les deux chemins renvoient exactement la même
valeur.

### 1.3 Le profil remplace le rôle pour les actions concernées

Les cinq contrôles qui étaient réservés à « administrateur + gestionnaire de
programme » utilisent maintenant un contrôle par **profil**, pas par libellé :

- propriétaire de la plateforme ;
- session `program_manager` historique (transition) ;
- identité `staff` qui détient le profil actif `program_manager`.

Un staff sans ce profil est refusé. Les actions concernées :
trois opérations de KPI, l'action d'intégration calendrier, l'historique de
connexion.

### 1.4 Les prédicats D-2

La couche d'identité expose désormais des prédicats nommés :
propriétaire de la plateforme, personnel interne, gestionnaire de programme
historique. Les listes qui étaient recopiées dans les ventures, les archives et
le portefeuille les utilisent.

Le commentaire de la liste des membres d'une venture, qui disait « le personnel
global voit », a été corrigé : le code ne laisse passer que le propriétaire de
la plateforme, puis une appartenance ou une affectation active.

### 1.5 Atterrissage après connexion

Une identité `staff` qui détient le profil `program_manager` atterrit dans
l'espace `/pm`, pas sur le tableau de bord staff. Sans le profil, elle atterrit
sur `/staff`. Le rôle `program_manager` historique continue d'atterrir sur `/pm`
tant que la bascule est désactivée.

---

## 2. Compteurs

| Indicateur | Avant | Après | Sens |
|---|---:|---:|---|
| `requireAuth` sans contrôle central | 106 | **105** | ↓ |
| Liste de travail sans capacité | 198 | **197** | ↓ |
| dont à protéger | 138 | **137** | ↓ |
| Listes de rôles en dur dans les actions | 181 | **177** | ↓ |
| Comparaisons de rôle hors moteur | 486 | **465** | ↓ |
| Exceptions figées du garde-fou | 292 | **284** | ↓ |
| Paires fichier#motif | 292 | **284** | ↓ |
| Actions « gestionnaire de programme seulement » | 5 | **0** | ↓ |
| Occurrences de `program_manager` | 227 | **227** | = |
| Valeurs de rôle à la connexion — mode par défaut | 9 | **9** | = |
| Valeurs de rôle à la connexion — mode `staff` | — | **8** | cible |
| Rôles de l'écran d'accès historique | 10 | **10** | reporté 1.5 |
| Politiques de périmètre | 7 | **7** | reporté Lot 3 |
| Nouvelles occurrences non listées | 0 | **0** | exigence |
| Exceptions périmées | 0 | **0** | exigence |

Note sur les valeurs de rôle : le compteur « 8 → 9 » n'est pas une régression.
Avant, le résolveur canonique transformait toujours le gestionnaire en staff,
tandis que le chemin `session-login` produisait encore `program_manager` : le
chiffre 8 ne décrivait que le premier. Désormais le compteur suit le **mode
actif** : 9 en mode historique, 8 en mode cible `staff`.

---

## 3. Pourquoi la bascule reste désactivée

Le prompt impose de remplir les profils **avant** de retirer le rôle global
(étape 1.4). La couverture ne peut pas être prouvée par le code seul. Une requête
de lecture seule est fournie :

```bash
node scripts/db-audit/run-readonly.mjs \
  scripts/db-audit/program-manager-profile-coverage.sql \
  .env.audit-readonly
```

Elle répond à deux questions bloquantes :

1. Combien de contacts `program_manager` n'ont **aucun** profil actif
   `program_manager` ?
2. Combien de personnes ont une affectation de gestionnaire de programme mais
   aucun profil correspondant ?

**Critère d'activation** : les deux compteurs de trou doivent être à `0`, et les
contrôles de programme qui lisent encore le rôle doivent avoir été migrés
(étape 1.3). À l'époque de cette étape, **22 appels role-only** à
`hasProgramManagementAccess` subsistaient. **Résolu au Lot 1.3** : les 22 appels
sont migrés, l'audit est à 0 trou et `AUTHZ_PM_IDENTITY=role` est devenu le
retour arrière, plus le défaut.

---

## 4. Tests

- `src/__tests__/login-role-unification.test.js` — les deux chemins appellent le
  même résolveur ; matrice des rôles ; les deux modes du gestionnaire.
- `src/__tests__/authz-program-manager-profile.test.js` — matrice pure du
  contrôle par profil (propriétaire, session historique, staff + profil, staff
  sans profil, autres identités).
- `src/__tests__/roles.test.js` — ajout des deux modes D-1 et de
  l'atterrissage `/pm`.
- `src/__tests__/security-phase3-public-surfaces.test.js` — mocks mis à jour
  pour le résolveur partagé.
- Cliquets + nouvelles suites : `npm run test:authz` → **6 suites, 36 tests verts**.
- Suites ciblées complémentaires (connexion, périmètre venture/programme, tâches,
  soumissions, gardes serveur) : **24 suites, 296 tests verts**.

---

## 5. Retour arrière

- Immédiat : laisser `AUTHZ_PM_IDENTITY` absent (ou `role`).
- Code : `git revert` du commit ; aucune écriture en base n'a été faite.
- Les actions migrées continuent d'accepter une session `program_manager`
  historique, donc le retour arrière ne les casse pas.

---

## 6. Compte rendu

```
LOT 1 — Un seul vocabulaire de rôle — étape 1.1 (+ prédicats 1.2)
Fait :
  - les deux connexions appellent resolveEffectiveRole
  - mode D-1 réversible (role | staff)
  - contrôle par profil pour les 5 actions PM
  - prédicats D-2 et remplacement des listes identiques
  - commentaire venture aligné sur le code
  - atterrissage /pm pour staff + profil program_manager
Compteurs :
  - requireAuth sans capacité : 106 → 105
  - liste de travail : 198 → 197 (dont à protéger 138 → 137)
  - listes de rôles en dur : 181 → 177
  - comparaisons de rôle : 486 → 465
  - exceptions figées : 292 → 284 (0 nouvelle, 0 périmée)
  - actions PM-only : 5 → 0
  - valeurs de connexion : 9 (mode rôle) / 8 (mode staff)
Divergences en mode ombre : aucune règle n'est basculée par défaut ; le mode
  historique est conservé. La bascule D-1 est prête mais non activée.
Tests ajoutés / passants : 2 suites ajoutées ; test:authz 6 suites / 36 tests
  verts ; 24 suites ciblées complémentaires vertes (296 tests).
Décisions requises : aucune pour continuer ; l'activation D-1 exige le résultat
  de l'audit de couverture et la migration des contrôles de programme (1.3).
Retour arrière : AUTHZ_PM_IDENTITY=role (défaut) ou git revert.
Prochaine étape : Lot 1.3 — migrer les contrôles de programme qui lisent encore
  le rôle, par lots de 20 ; puis exécuter l'audit de couverture et activer le
  mode staff.
```
