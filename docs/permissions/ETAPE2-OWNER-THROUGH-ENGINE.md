# Étape 2 — le propriétaire passe par le même chemin

Statut : **implémenté derrière un drapeau, désactivé par défaut, vérifié en
staging le 2026-11-12**. La production n'est pas encore vérifiée : le drapeau
reste donc à `false` tant que la photographie de production n'a pas été faite.

---

## Le drapeau

```bash
AUTHZ_OWNER_THROUGH_ENGINE=true
```

- **absent ou `false`** : comportement historique. Le propriétaire contourne
  l'éligibilité et la porte du compte ; ses droits viennent du profil
  `super_admin_default`, avec la matrice complète de secours si le profil
  manque.
- **`true`** : le propriétaire est résolu par le chemin normal. Il est soumis à
  l'éligibilité, à la porte du compte et à sa matrice de droits, exactement
  comme tout le monde.

Le cache de contexte inclut ce mode dans sa clé : basculer le drapeau ne peut
pas servir un contexte résolu avec l'autre mode.

---

## Ce que le mode change

| Question | Mode historique | Mode « même chemin » |
|---|---|---|
| Éligibilité | contournée | lue dans les lignes d'éligibilité |
| Statut du compte | contourné | `contacts.status` appliqué |
| Droits | profil + matrice de secours | profil uniquement |
| Blocages personnels | appliqués | appliqués |
| Explication de permission | « super_admin bypass » | lignes d'éligibilité réelles |

Le propriétaire reste identifié comme propriétaire (`isSuperAdmin: true`) pour
l'interface ; seule la **décision** change de chemin.

---

## Vérification en staging

Comparaison entre le mode historique et le mode « même chemin », sur la base
complétée de l'étape 1 :

- **12 changements**, tous de même nature : l'éligibilité du propriétaire passe
  de `null` (contournement) à `true` explicite pour les 12 fonctionnalités.
- **0 régression**, **0 ouverture de droit**, **0 entrée de menu perdue ou
  ajoutée**, **0 changement d'arrivée**.

Autrement dit : en staging, le propriétaire conserve exactement les mêmes
droits et le même menu. La seule différence est que sa décision devient
explicite et vérifiable.

Tests : `npm run test:authz` (14 suites, 101 tests) et la suite dédiée
`authorization-owner-through-engine` (9 tests).

---

## Préconditions avant d'activer en production

1. `npm run authz:doctor -- --env .env.prod-verify --allow-production --strict`
   doit répondre **OK**.
2. La photographie de production doit exister et servir de référence.
3. Le compte du propriétaire doit être **actif**.
4. Son profil par défaut doit contenir **tous** les droits du catalogue.
5. Activer le drapeau, puis relancer la photographie et comparer :
   - **0 régression** attendue ;
   - les seuls changements acceptables sont les éligibilités du propriétaire
     passant de « contournée » à « explicite ».

## Retour arrière

Retirer le drapeau (ou le mettre à `false`) et redémarrer. Aucune donnée n'a été
modifiée par le mode lui-même.

---

## Ce qui reste hors de ce lot

Le moteur de décision est couvert. D'autres raccourcis « propriétaire » vivent
encore dans des gardes de domaine et seront traités dans les lots suivants :

- le garde « gestionnaire de programme » admet le propriétaire par son rôle ;
- l'accès à une ressource précise (`scopedAccess`) dispense le propriétaire de
  l'affectation, mais exige désormais le droit et passe par la décision
  normale ;
- la navigation conserve des tables par rôle (étape 3).

Ces points sont déjà inventoriés dans `ETAPE0-WHOAUDIT.md`.
