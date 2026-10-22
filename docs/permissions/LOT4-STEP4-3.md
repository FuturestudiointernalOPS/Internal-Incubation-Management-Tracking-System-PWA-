# Lot 4 — deux décisions : historique de connexion, décisions déléguées

> Date : 2026-10-20.

---

## 1. Historique de connexion — administration seulement

**Décision** : seul le propriétaire de la plateforme — ou une identité à qui l'on
accorde explicitement la capacité — peut consulter l'historique de connexion.

**Mise en œuvre** : la route exige `users.view`. La liste de rôles (qui
admettait aussi le personnel et les gestionnaires de programme) disparaît, et
avec elle le contrôle de profil qui la complétait.

**Effet** : un membre du personnel ou un gestionnaire de programme perd cet
accès. C'est la décision demandée. La capacité reste attribuable sans changer
de code.

---

## 2. Courriel alternatif — une décision déléguée, désormais déclarée

### Ce que c'est

Une **seconde adresse e-mail** rattachée à la fiche d'une personne. Elle sert à
reconnaître que deux adresses désignent la même personne — pour éviter les
doublons et rattacher un dossier au bon contact — mais **elle ne devient jamais
un identifiant de connexion**.

### La règle déjà en place

- chacun gère ses propres adresses ;
- un membre du personnel ne peut gérer celles d'une autre personne que s'il
  **partage un programme** avec elle.

Cette règle a besoin de la relation entre l'appelant et la cible : elle vit donc
dans un service, pas dans le fichier de la route.

### Ce qui manquait

Le registre ne savait représenter que trois formes (capacité, personnelle,
ouverte). Une route dont la décision est déléguée à un service était donc
classée « à protéger » — un faux positif dans la liste de travail.

### La décision prise

Le registre accepte une **quatrième forme : `delegated`**. Elle ne dispense de
rien : elle nomme le service, la règle et la raison, pour qu'un relecteur puisse
suivre la décision. Une route déclarée `delegated` quitte la dette, et le test
vérifie que le service et la règle sont nommés.

Première entrée : les courriels alternatifs.

---

## 3. Compteurs

| Indicateur | Avant | Après |
|---|---:|---:|
| Actions en dette | 143 | **141** |
| Formes de déclaration | 3 | **4** (+ `delegated`) |
| Accès retirés | — | historique de connexion pour personnel et gestionnaires (voulu) |

---

## 4. Tests

- `action-declarations` : la quatrième forme, la validation du service et de la
  règle, et le fait qu'une décision déléguée quitte la dette.
- `permissions-characterization` : l'historique de connexion fige désormais
  `users.view` et l'absence de liste de rôles.
- `permissions-static-guards` : une exception devenue périmée retirée.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run lint` → 0 erreur.

---

## 5. Retour arrière

`git revert`. Aucune écriture en base.

---

## 6. Compte rendu

```
LOT 4 — décisions du 2026-10-20
Fait :
  - historique de connexion réservé à l'administration (users.view)
  - quatrième forme de déclaration : delegated (service + règle nommés)
  - courriels alternatifs sortis de la liste de travail
Compteurs :
  - dette : 143 -> 141
  - formes de déclaration : 3 -> 4
Accès retirés : historique de connexion pour personnel et gestionnaires (voulu).
Tests : registre et caractérisation verts ; 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
```
