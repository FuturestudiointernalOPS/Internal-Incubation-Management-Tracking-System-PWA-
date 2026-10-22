# Annexe 3 — Période de validité des affectations (`starts_at` / `ends_at` / révocation)

> Phase 0 complémentaire. **Audit uniquement — aucune correction appliquée.**
> Question : la décision d'autorisation vérifie-t-elle **directement** la période
> de validité (`starts_at`, `ends_at`) et la révocation, ou dépend-elle d'une copie ?

## 1. Références précises (fichier:ligne) et conditions appliquées

### 1.1 Droits personnels (« copie » dérivée des relations)

`src/models/authorization/contextReads.js:29-33` — lecture des droits accordés :

```sql
SELECT module, capability, access_level FROM user_capabilities
WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())
```

`src/models/authorization/contextReads.js:38-42` — lecture des restrictions :

```sql
SELECT module, capability FROM user_capability_restrictions
WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())
```

**Condition appliquée** : borne de **fin** vérifiée (`expires_at > NOW()`) et
révocation = suppression de la ligne (`DELETE FROM user_capabilities`).
**Condition absente** : la table `user_capabilities` **n'a pas de colonne de
début** (schéma observé : `user_cid, module, capability, access_level, granted_by,
expires_at`). Un droit personnel ne peut donc pas être « daté dans le futur ».

### 1.2 Affectations de profil (le plafond contextuel)

`src/models/authorization/profileAssignmentsStore.js:79-84` — profiles actifs :

```sql
SELECT DISTINCT profile_key FROM profile_assignments
WHERE contact_cid = ? AND status = 'active'
  AND (ends_at IS NULL OR ends_at > NOW())
ORDER BY profile_key
```

Même schéma en `:96-101` (`countActiveAssignmentsForProfileKey`) et `:164-172`
(`findActiveAssignment`).

**Condition appliquée** : `status = 'active'` **et** borne de **fin**
(`ends_at > NOW()`).
**Condition absente** : la **borne de début** (`started_at`) n'est **jamais
vérifiée**, alors que la colonne existe (`profileAssignmentsStore.js:27-37` :
`started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`).

### 1.3 Révocation

| Objet | Mécanisme | Emplacement | Effet |
|---|---|---|---|
| Droit personnel | suppression de la ligne (`DELETE FROM user_capabilities`) | (mock de test `programAssignmentGrants.js:148-156` ; écritures dans `services/authorization/permissionWrites.js`) | immédiat, pas de copie |
| Affectation de profil | `closeProfileAssignment` → `status='ended'`, `ended_at` | `profileAssignmentsStore.js:236-242` | immédiat ; la ligne reste (historique) |

Révocation **vérifiée à la décision** dans les deux cas (par `status`/absence de
ligne), pas via une copie.

## 2. Conclusion — état exact

| Borne | Vérifiée à la décision ? | Conséquence |
|---|---|---|
| Fin (`ends_at` / `expires_at > NOW()`) | **OUI** | une affectation expirée cesse d'être active |
| Statut (`status='active'`) | **OUI** | une affectation fermée n'est plus active |
| Révocation | **OUI** (immédiate) | — |
| **Début (`started_at <= NOW()`)** | **NON** | **écart** : une affectation datée dans le futur est traitée comme active **immédiatement** |

### 2.1 Impact concret

Un profil (`program_manager`, `facilitator`, `participant`, …) dont l'affectation
porte `started_at` dans le futur est **inclus** par `listActiveProfileKeys`, donc
son plafond d'éligibilité et ses capacités de base sont accordés **avant** la date
prévue. La spécification §9.1 impose une période **semi-ouverte, début inclus** :
cet écart est donc **contre la spec**.

### 2.2 Ce qui est conforme (nuance de la famille F du prompt)

Contrairement à l'affirmation « la décision lit une copie, pas la période », le
code **lit bien la période** pour la fin, le statut et la révocation. La « copie »
(`user_capabilities`) est elle-même **datée** (`expires_at`) et filtrée à la
lecture. La seule insuffisance mesurée est **l'absence de borne de début**.

## 3. Test ciblé (PROPOSÉ — non écrit dans le code, non exécuté)

Rappel des règles de la phase : **aucune modification de code**. Le test ci-dessous
est donc fourni comme **proposition**, à ajouter en Phase 2. Il cible le resolver
avec une base simulée.

```js
// src/__tests__/authorization-assignment-start.test.js  (PROPOSÉ — non créé)
test("une affectation dont la date de début est dans le futur n'est PAS active", async () => {
  // profile_assignments renvoyé par la base simulée :
  serveDb([{ profile_key: "program_manager", status: "active",
             started_at: "2999-01-01T00:00:00Z", ends_at: null }]);
  const ctx = await resolveAuthorizationContext({ cid: "C1", role: "staff" });
  expect(ctx.profiles).not.toContain("program_manager");
});
```

**Comportement attendu vis-à-vis du code ACTUEL** : ce test **échouerait**, parce
que `listActiveProfileKeys` filtre sur `status` + `ends_at` mais pas sur
`started_at` — l'affectation future serait comptée comme active. (Constat déduit
de la requête, **non exécuté** : la phase interdit l'ajout du fichier de test.)

## 4. Correction minimale recommandée (NON appliquée)

Ajouter la **borne de début** aux lectures d'affectations actives, sans changer le
reste :

- `profileAssignmentsStore.js:79-84` (`listActiveProfileKeys`) ;
- `:96-101` (`countActiveAssignmentsForProfileKey`) ;
- `:164-172` (`findActiveAssignment`) ;
- `:128-136` (`listActiveAutomaticAssignments`).

Condition à ajouter :

```sql
AND (started_at IS NULL OR started_at <= NOW())
```

Points d'attention (à traiter en Phase 4, pas ici) :

- Convention `NOW()` en UTC — cohérente avec le reste (spec §9.1).
- Les droits personnels (`user_capabilities`) n'ont **pas** de colonne de début :
  si le produit veut des droits datés dans le futur, il faut **ajouter** la
  colonne ; sinon, documenter que seuls les droits immédiats existent.
- Ne **pas** toucher aux droits déjà accordés (aucune migration destructive).
- Le recalcul périodique reste un simple rafraîchissement d'affichage (spec §9.2) :
  la borne de début doit être vérifiée **à la décision**, pas par un job.

## 5. Incertitudes

- L'effet réel en base dépend du contenu de `profile_assignments` (non lisible
  depuis le code) : combien d'affectations ont un `started_at` futur ? Non mesuré.
- Le comportement de `listActiveAutomaticAssignments` (utilisé par le réconciliateur)
  n'a pas été tracé jusqu'à son consommateur final dans cet audit.
- Un éventuel tri par `started_at` (affichage) n'a pas été inventorié.
