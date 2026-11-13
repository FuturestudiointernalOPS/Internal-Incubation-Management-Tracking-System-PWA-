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

## L'interface suit la même règle

Le moteur était couvert, mais les écrans court-circutaient encore chaque droit
sur la seule identité : `isSuperAdmin` ⇒ tout autorisé. Un droit retiré au
propriétaire restait donc affiché comme accordé.

`GET /api/me/permissions` publie maintenant **deux** faits distincts :

| Champ | Sens |
|---|---|
| `isSuperAdmin` | fait d'identité : c'est le propriétaire |
| `ownerThroughEngine` | le propriétaire est résolu par le moteur (drapeau actif) |

La règle appliquée par les trois surfaces de capacité est unique :

```
le propriétaire est court-circuité SEULEMENT si isSuperAdmin && !ownerThroughEngine
```

- `src/lib/PermissionProvider.js` — `can()` ;
- `src/app/platform/layout.js` — `hasCapability()` de la barre plateforme ;
- `src/components/shared/crm/useCrmCapabilities.js` — `holds()`.

Comme le profil `super_admin_default` contient tous les droits du catalogue,
rien ne change en pratique tant qu'aucun droit n'est retiré. Dès qu'un droit est
retiré ou bloqué, l'écran cesse de le proposer — ce qui est le but.

> Les raccourcis d'affichage keyés sur l'identité ont été corrigés : l'écran
> complet des contacts s'ouvre sur `contacts.create`/`contacts.edit`, et
> l'action suivante d'un enregistrement CRM s'ouvre sur le nouveau droit
> **`crm.next_action_any`** (l'exception « support/réparation »), plus sur un
> rôle. Le composant mort `CrmOverview` (mode « full state ») est supprimé.

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

Tests : `npm run test:authz` (23 suites, 249 tests), dont la suite dédiée
`authorization-owner-through-engine` et la suite d'interface
`owner-through-engine-ui`.

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

Le moteur de décision, les surfaces de capacité de l'interface et les raccourcis
d'affichage nommés ci-dessus sont couverts. D'autres raccourcis « propriétaire »
vivent encore dans des gardes de domaine et seront traités dans les lots
suivants :

- le garde « gestionnaire de programme » admet le propriétaire par son rôle ;
- l'accès à une ressource précise (`scopedAccess`) dispense le propriétaire de
  l'affectation, mais exige désormais le droit et passe par la décision
  normale ;
- les écrans d'administration qui comparaient `isPlatformOwnerRole` (page
  Blockers, page Investisseurs, page Work) sont **convertis** : voir
  `ETAPE7-ADMIN-SCREEN-GUARDS.md` ;
- `src/services/tasks/blockers.js` admet encore le rôle propriétaire pour
  **lever ou modifier** un blocker sur une tâche qu'on ne possède pas (règle
  d'écriture, hors des trois écrans ci-dessus).

Ces points sont déjà inventoriés dans `ETAPE0-WHOAUDIT.md`.
