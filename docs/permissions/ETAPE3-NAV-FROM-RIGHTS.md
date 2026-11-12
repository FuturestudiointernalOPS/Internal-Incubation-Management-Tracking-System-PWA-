# Étape 3 — menu dérivé des droits (implémenté derrière un drapeau)

Statut : **implémenté le 2026-11-12, désactivé par défaut, vérifié en staging**.
Aucune décision d'accès n'a changé.

```bash
AUTHZ_NAV_FROM_RIGHTS=true
```

- **absent ou `false`** : le menu actuel, piloté par les tables de rôle.
- **`true`** : le menu est construit à partir de l'arbre maître et des droits
  détenus. Les tables de rôle ne servent plus qu'aux **adresses** et aux
  **icônes**.

Le mode ne s'applique qu'aux espaces **personnel interne** et **propriétaire**.
Les menus personnels des membres (facilitateur, investisseur, participant)
restent inchangés : ils dépendent du contexte de la personne, pas d'un droit
unique.

---

## Fonctionnement

1. Chaque destination de l'arbre maître a un droit :
   - le droit déjà déclaré dans le code pour 31 destinations ;
   - la proposition de l'étape 3 pour les 43 autres
     (`src/models/authorization/navData.js`).
2. Une destination `public` est visible sans droit.
3. Une destination avec droit est visible si au moins une de ses alternatives
   est détenue.
4. Une section apparaît si au moins un de ses enfants est visible. Si aucun
   enfant n'est accessible dans l'espace de la personne, la section se replie
   sur l'adresse que son rôle lui donne (par exemple « Programmes » pour le
   personnel).
5. Le filtre d'espace empêche les fuites :
   - le propriétaire ouvre les surfaces propriétaire, personnel interne et
     partagées, jamais les portes personnelles des membres ;
   - le personnel reste dans les surfaces personnel interne et partagées ;
   - une adresse explicitement donnée par le rôle gagne toujours (le profil
     personnel du rôle finance, par exemple).

---

## Vérification en staging

Comparaison avec la photographie post-application de l'étape 1 :

- **36 changements** ;
- **0 changement de droit** (aucun droit accordé ou retiré) ;
- **31 ajouts de menu** ;
- **5 pertes**, toutes identiques : la porte « Forms » pour cinq membres du
  personnel.

### Les ajouts

- Le personnel gagne **Groups**, **Operations** (avec Standup/Retro) et
  **Reports** (avec My Projects) : ces droits sont déjà dans son profil, mais la
  table de rôle ne les affichait pas.
- Le propriétaire gagne **Groups**.

### La seule perte : Forms

La page Forms interroge une API qui exige le droit **voir les formulaires**. Le
profil par défaut du personnel ne le contient pas. La porte actuelle est donc
déjà morte : elle s'affiche, mais l'API refuse. Le mode droits la retire.

Deux issues possibles, à trancher :

1. **Accorder les droits Forms au personnel** (voir, créer, modifier, supprimer,
   selon l'usage) : la porte est conservée et devient réellement utilisable.
2. **Accepter le retrait** : la porte disparaît tant que le droit n'est pas
   donné.

Le commentaire du code affirme que le profil du personnel détient déjà le droit
de créer des formulaires ; la base montre le contraire. C'est un écart de
données à corriger dans un sens ou dans l'autre.

---

## Activation et retour arrière

- Activer le drapeau après avoir tranché la question Forms.
- Retour arrière immédiat : retirer le drapeau.
- Le mode est couvert par
  `src/__tests__/navigation-from-rights.test.js` (7 tests) et n'affecte pas les
  tests de navigation existants quand il est désactivé.

## Reste à faire

1. Trancher Forms (accorder ou accepter le retrait).
2. Étendre le mode aux contextes membres avec un filtre fondé sur les profils
   actifs (facilitateur, investisseur, participant).
3. Supprimer progressivement les tables de rôle une fois le mode activé et
   vérifié en production.
