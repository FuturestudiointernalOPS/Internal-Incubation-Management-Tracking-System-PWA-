# Lot 1 — étape 1.3 : migration des contrôles de programme et activation D-1

> Date : 2026-10-19. Décision D-1 : le gestionnaire de programme est une
> identité `staff` qui détient le profil `program_manager`.
>
> Cette étape exécute l'audit de couverture, migre les contrôles qui lisaient
> encore le rôle, puis active la bascule par défaut.

---

## 1. Audit de couverture (lecture seule)

Commande :

```bash
node scripts/db-audit/run-readonly.mjs \
  scripts/db-audit/program-manager-profile-coverage.sql \
  .env.local
```

Résultat sur la base pointée par `.env.local` (production, **SELECT uniquement**) :

| Question | Résultat |
|---|---:|
| Contacts portant encore le rôle `program_manager` | **0** |
| Personnes avec un profil `program_manager` actif | **1** |
| Gestionnaires historiques sans profil actif | **0** |
| Affectations de gestionnaire sans profil | **0** |

Aucune ligne personnelle n'a été affichée : la requête nominative du fichier est
commentée par défaut. Le runner a exécuté 4 statements, 0 ignoré.

Conclusion : la couverture est complète. La bascule peut être activée.

---

## 2. Les 22 contrôles migrés

Les appels `hasProgramManagementAccess(role)` ont été remplacés par un contrôle
asynchrone qui résout le profil quand la session est `staff` :

- `isProgramManagerSession(session)` — propriétaire de la plateforme **ou**
  gestionnaire de programme (rôle historique ou profil actif).
- `isProgramManagerProfileSession(session)` — gestionnaire de programme
  uniquement, sans le propriétaire de la plateforme. Utilisé là où le
  propriétaire doit rester exempté (décision de revue, verrou de rôle).

Répartition :

| Zone | Appels migrés |
|---|---:|
| Services métier (revues facilitateur, tableau d'équipe, relances, programmes participants, périmètre des soumissions) | 7 |
| Garde de ressource générique | 1 |
| Actions serveur (programmes, présences, familles, revues, équipes PM, état complet, participants, équipes, sessions, soumissions) | 14 |

Contrôles supplémentaires alignés sur le profil :

- décision d'une revue facilitateur : le gestionnaire ne décide que pour un
  programme qu'il gère ;
- chronologie d'un contact : un gestionnaire reste borné à ses programmes ;
- verrou de rôle des soumissions : un `staff` avec le profil enregistre
  `program_manager` comme camp de décision, donc le verrou tient toujours ;
- conflit « gestionnaire ≠ facilitateur » : le drapeau `is_program_pm` est
  désormais consulté, pas seulement le libellé ;
- annuaire des contacts : la fenêtre « actifs + en attente » suit le profil, pas
  le libellé.

---

## 3. Activation

Le mode par défaut est maintenant `staff` :

```js
// Aucune variable nécessaire.
// Retour arrière ponctuel :
AUTHZ_PM_IDENTITY=role
```

Effet observable :

- la connexion renvoie `staff` pour un contact `program_manager` ;
- l'atterrissage est `/pm` si le profil actif est présent, `/staff` sinon ;
- les 22 contrôles reconnaissent le profil ;
- les sessions historiques `program_manager` restent acceptées pendant la
  transition ;
- `AUTHZ_PM_IDENTITY=role` restaure le libellé historique pour un déploiement.

---

## 4. Compteurs

| Indicateur | Avant 1.3 | Après 1.3 |
|---|---:|---:|
| Appels `hasProgramManagementAccess` hors helper | 22 | **0** |
| Décisions qui lisent encore le rôle `program_manager` | 76 | **76** |
| Actions « gestionnaire de programme seulement » | 0 | **0** |
| Valeurs de rôle à la connexion | 9 | **8** |
| Comparaisons de rôle hors moteur | 465 | **462** |
| Exceptions figées du garde-fou | 284 | **282** |
| Nouvelles occurrences non listées | 0 | **0** |
| Exceptions périmées | 0 | **0** |

Le compteur « 76 décisions » mesure les **autres** endroits qui lisent encore le
libellé (interface, listes de rôles historiques, un contrôle transitoire). Ils
relèvent des lots 1.3 restants / 1.5 / 1.7, pas des 22 contrôles migrés ici.
Les mentions brutes du libellé (229) sont informatives : elles incluent les
commentaires et le nom du profil.

---

## 5. Tests

- `npm run test:authz` → **6 suites, 40 tests verts**
- Suites ciblées complémentaires (connexion, périmètre, tâches, soumissions,
  présence, équipes, revues) → **21 suites, 267 tests verts**
- `npm run authz:metrics:check` → **cliquet respecté**
- `npm run lint` → **0 erreur**

---

## 6. Retour arrière

1. `AUTHZ_PM_IDENTITY=role` (aucun redéploiement de données).
2. `git revert` du commit Lot 1.3.
3. Aucune écriture en base n'a été faite par cette étape : l'audit est en
   lecture seule.

---

## 7. Compte rendu

```
LOT 1 — Un seul vocabulaire de rôle — étape 1.3
Fait :
  - audit de couverture en lecture seule (4 SELECT, 0 écriture)
  - 22 contrôles de programme migrés vers le profil
  - contrôle de décision, chronologie, verrou de rôle et annuaire alignés
  - activation D-1 par défaut (retour arrière AUTHZ_PM_IDENTITY=role)
Compteurs :
  - appels hasProgramManagementAccess hors helper : 22 → 0
  - valeurs de connexion : 9 → 8
  - comparaisons de rôle : 465 → 462
  - exceptions figées : 284 → 282 (0 nouvelle, 0 périmée)
  - actions PM-only : 0
Divergences en mode ombre : aucune règle n'a été basculée sans mesure ; l'audit
  de couverture est à 0 trou et les contrôles ont été migrés avant l'activation.
Tests ajoutés / passants : 21 suites / 267 tests verts ; test:authz 6/40.
Décisions requises : aucune.
Retour arrière : AUTHZ_PM_IDENTITY=role ou git revert.
Prochaine étape : Lot 1.5 (réduire les listes de rôles restantes) puis Lot 2
  (une seule forme de refus).
```
