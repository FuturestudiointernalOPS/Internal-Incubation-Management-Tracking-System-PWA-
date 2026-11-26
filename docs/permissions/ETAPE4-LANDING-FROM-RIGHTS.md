# Étape 4 — arrivée calculée depuis les droits (implémenté derrière un drapeau)

Statut : **implémenté le 2026-11-12, désactivé par défaut, vérifié en staging**.
Aucune décision d'accès n'a changé.

```bash
AUTHZ_LANDING_FROM_RIGHTS=true
```

- **absent ou `false`** : l'arrivée actuelle, décidée par `resolveLanding` à
  partir du rôle et des relations.
- **`true`** : l'arrivée est évaluée par `resolveLandingFromAccess` à partir de
  l'espace, des **profils actifs**, des relations et des **droits détenus**.

---

## Pourquoi

L'ancienne règle ne consultait jamais les droits : elle répondait « cette
personne est `staff`, donc `/staff` » ou « elle fonde une venture, donc dedans ».
Deux conséquences :

1. une personne dont un droit est retiré continuait d'être déposée sur une
   surface qu'elle ne peut plus ouvrir ;
2. l'arrivée et les portes du menu pouvaient se contredire — le bouton
   « Dashboard » du menu personnel pointait déjà vers l'espace fondateur alors
   que la connexion déposait la personne sur le hub neutre.

L'étape 4 fait de l'arrivée une **conséquence** des profils et des droits, pas
un étiquetage de rôle.

---

## Fonctionnement

La liste de priorité est une **donnée** : `src/models/authorization/landingData.js`.
`resolveLandingFromAccess` ne fait que l'évaluer, dans l'ordre.

Chaque entrée porte :

| Champ | Sens |
|---|---|
| `space` | espace structurel (`admin`, `staff`, `member`) — filtre de fuite |
| `role` | rôle exact (seul `team` s'en sert) |
| `profile` / `relationship` | **alternative** : un profil actif **ou** un fait suffit à ouvrir |
| `capability` | droit **exigé en plus**, quand il est présent |
| `kind` | destination dynamique (`owned-venture`, `team`) |

Règles d'évaluation :

1. Une entrée d'un autre espace est ignorée.
2. Sans profil ni relation satisfaits, l'entrée est ignorée.
3. Un droit **refusé** écarte l'entrée.
4. Un droit **inconnu** (matrice non chargée) n'écarte que les entrées
   **sans** profil ni relation : un profil ou une relation suffit toujours à
   justifier une destination.
5. Le repli final est **l'accueil de l'espace**, jamais un rôle : `/admin`,
   `/staff`, `/member`.

### Cas notables

- **Le propriétaire** est déposé sur `/admin` par l'accueil de son espace, même
  si le droit « voir la matrice » lui est retiré. L'accueil d'un espace n'est pas
  une permission.
- **Le personnel sans profil particulier** tombe sur `/staff` : c'est le repli de
  l'espace, pas une table de rôle.
- **Le profil `program_manager`** ne suffit pas : le droit `programs.view` doit
  être détenu en plus, sinon la personne reste sur `/staff`.
- **Plusieurs ventures fondées** ne font pas choisir une venture : la personne
  arrive sur son **accueil fondateur**, comme le bouton « Dashboard » de son menu
  le faisait déjà.
- **Le compte `team`** garde son espace.

---

## Vérification en staging

Comparaison avec la photographie post-application de l'étape 1 :

- **3 changements** ;
- **0 régression** (aucun droit retiré) ;
- **0 changement de droit** ;
- les 3 seuls changements sont des **arrivées** : `/member` → `/member/founder`.

Ces trois personnes fondent **plusieurs** ventures actives. L'ancienne règle
refusait de choisir entre elles et les déposait sur le hub neutre ; leurs portes
de menu pointaient pourtant déjà vers l'accueil fondateur. La nouvelle règle
choisit l'**accueil du contexte**, pas une venture : elle ne choisit toujours
rien pour eux et corrige la contradiction menu / arrivée.

---

## Activation et retour arrière

- Activer après avoir relu les 3 changements d'arrivée ci-dessus.
- Retour arrière immédiat : retirer le drapeau.
- Couvert par `src/__tests__/landing-from-access.test.js` (19 tests) et par
  `src/__tests__/login-landing.test.js`, qui vérifie que les deux chemins
  (règle actuelle et règle droits) coexistent et sont choisis par le même
  drapeau.

## Outils

```bash
# Photographie + comparaison, avec l'arrivée calculée depuis les droits
AUTHZ_LANDING_FROM_RIGHTS=true npm run authz:snapshot -- \
  --compare scratch/authz-reference/<référence>.json
```

Le script `scripts/authz-reference-snapshot.mjs` accepte le même drapeau et
applique exactement la règle de l'application.

## Reste à faire

1. Étendre la vérification à la production dès que la photographie de
   production est disponible.
2. Supprimer `ROLE_HOME` et `resolveLanding` une fois le drapeau activé et
   vérifié en production (étape 6).
