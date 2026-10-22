# Runbook — Mode ombre et bascule de portée (Phase 5, c3b/c3c)

> **Nature** : procédure **opérationnelle** (à exécuter par un humain sur un
> environnement de staging). L'agent a livré **la mécanique** ; la collecte
> elle-même se fait en staging.
> **But** : mesurer les divergences entre l'ancien contrôle et le moteur AVANT de
> basculer, puis basculer un lot à la fois, réversiblement.

## 0. Ce qui est déjà en place (vérifié)

| Élément | Fichier | État |
|---|---|---|
| Comparateur pur | `src/services/authorization/shadow.js` (`compareDecisions`) | ✅ |
| Collecte + agrégation | `src/services/authorization/shadow.js` (`shadowCheck`, `getShadowReport`, `resetShadowReport`) | ✅ |
| Branchement (portée) | `src/services/authorization/scopedAccess.js` (`decide`, policy program/venture) | ✅ |
| Rapport lisible | `GET /api/engineering/permissions/shadow-report` | ✅ |
| Reset | `DELETE /api/engineering/permissions/shadow-report` | ✅ |
| Tests | `permissions-shadow.test.js`, `permissions-scope-shadow.test.js`, `phase5-shadow-report-api.test.js` | ✅ |

**Inert par défaut** : rien n'est comparé tant que `AUTHZ_SHADOW_MODE !== "1"`.

## 1. Activer la mesure (staging uniquement)

1. Poser la variable d'environnement **`AUTHZ_SHADOW_MODE=1`** sur le service
   staging, puis redéployer/redémarrer.
2. **Vérifier** que le flag est pris : `GET /api/engineering/permissions/shadow-report`
   → `"enabled": true` (avec une session portant `permissions.view_matrix`).
3. **Repartir de zéro** avant la campagne : `DELETE /api/engineering/permissions/shadow-report`.

> ⚠️ **Le tampon est en mémoire, par instance** (comme le limiteur de débit). Pour
> une campagne sérieuse : instance unique, ou lecture rapprochée. Un tampon
> partagé (Redis/DB) est une évolution possible, hors périmètre.

## 2. Exercer les contrôles mesurés

Le branchement actuel couvre la **portée** des ressources `program` et `venture`
(`decide`) : il compare l'assignation ad hoc (`resolveContextAssignment`) à la
policy du moteur (`isWithinScope` : `program_assigned`, `venture_own`).

Pour produire des données, faire tourner des appels scoped sur les deux verdicts :
- un **membre** d'un programme (doit être autorisé des deux côtés) ;
- un **étranger** au programme (doit être refusé des deux côtés) ;
- un **membre** d'un venture, un **étranger** ;
- des cas limites : ressource absente, compte désactivé, super admin.

Chaque **désaccord** est journalisé (`authz_shadow_divergence`) **et** agrégé.

## 3. Lire le rapport

`GET /api/engineering/permissions/shadow-report` renvoie :

```json
{
  "success": true,
  "enabled": true,
  "total": 12,
  "byKey": {
    "program:program_assigned": { "count": 9, "legacyAllowEngineDeny": 2, "legacyDenyEngineAllow": 7 }
  },
  "recent": [ { "key": "program:program_assigned", "resource": "program", "policy": "program_assigned", "contextId": "P1", "cid": "U1", "legacyAllowed": true, "engineAllowed": false } ]
}
```

Lecture :
- `legacyAllowEngineDeny` : l'ancien code **ouvrait**, le moteur **ferme** → suspect
  (soit l'ancien code sur-autorise, soit la policy est mal réglée).
- `legacyDenyEngineAllow` : l'ancien code **fermait**, le moteur **ouvre** → suspect
  (soit l'ancien code sous-autorise, soit la policy est trop large).

## 4. Analyser les divergences (obligatoire : aucune ne reste inexpliquée)

Pour **chaque** divergence : décider si c'est
1. un **bug de l'ancien code** (corriger vers la spec), ou
2. un **modèle/policy mal réglé** (corriger le modèle, pas le moteur).

Consigner le verdict dans le tableau de suivi du lot. **Aucune bascule tant
qu'une divergence reste ouverte.**

## 5. Basculer un lot (c3c)

1. Choisir **un** lot (10–20 contrôles, du plus risqué au moins risqué).
2. Vérifier que le lot est **propre en ombre** (0 divergence).
3. Basculer le lot sur le moteur seul ; retirer l'ancien contrôle.
4. Retirer le lot de la **liste d'exceptions** de `permissions-static-guards.test.js`
   (le ratchet ne peut que diminuer).
5. Rejouer les **tests de caractérisation** (Phase 2).
6. Désactiver `AUTHZ_SHADOW_MODE` si le lot est le dernier.

## 6. Retour arrière

- **Mesure seule** : `AUTHZ_SHADOW_MODE` retiré → tout redevient inerte.
- **Lot basculé** : réintroduire l'ancien contrôle et retirer le branchement
  moteur du lot (aucune donnée, aucune migration). Les tests de caractérisation
  redeviennent rouges si un garde-fou manque — signal attendu.

## 7. Critère de sortie Phase 5

- Liste d'exceptions du ratchet anti-contrôle-par-rôle = **0**.
- **Aucune** divergence ouverte.
- Deux personnes identiques à l'écran sont traitées de façon identique partout.
