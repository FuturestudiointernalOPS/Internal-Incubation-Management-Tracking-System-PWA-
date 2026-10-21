# Lot 8 — étape 8.6 : un seul vocabulaire de connexion, migration automatique

> Date : 2026-10-20. Les quatre anciens libellés contextuels quittent la
> connexion. Leur fonction est portée par le **profil**. La normalisation des
> personnes déjà stockées s'exécute **toute seule**, une fois par base, au
> démarrage.

---

## 1. Ce qui change

Il n'existe plus que **trois identités de base** (`super_admin`, `staff`,
`member`) et les comptes d'entité (`team`). Un ancien libellé n'est plus produit
à la connexion :

| Libellé stocké | Identité renvoyée à la connexion | Fonction |
|---|---|---|
| `participant` | `member` | profil `participant` (programme) |
| `facilitator` | `member` ou `staff` selon l'appartenance interne | profil `facilitator` (programme) |
| `investor` | `member` | profil `investor` (contexte investisseur) |
| `founder` | `member` | profil `founder` (venture) |

Le gestionnaire de programme suit la décision D-1 : identité `staff` + profil
`program_manager`. `AUTHZ_PM_IDENTITY=role` reste le retour arrière d'un
déploiement.

Une valeur enregistrée qui porterait encore l'un de ces quatre noms est
**reconnue puis normalisée**, jamais refusée. Un écrivain (inscription,
import, approbation, inscription à un groupe) passe la valeur par
`normalizeIdentityForStorage` avant l'écriture : le profil ne peut être
attribué qu'à `member`, donc réécrire l'ancien nom recréerait l'incohérence que
la migration vient de supprimer.

## 2. Les deux conséquences visibles, assumées

1. **Une inscription personnelle reste en attente.** Un membre est `pending`,
   exactement comme l'était un participant. L'approbation ne change pas.
2. **Un membre dont le profil est incomplet atterrit sur son profil.** L'ancien
   participant atterrissait sur le même écran ; le hub neutre reste accessible.

Ce sont les deux seuls effets d'écran. Ils sont couverts par
`login-landing.test.js` et `login-role-unification.test.js`.

## 3. La migration de données s'exécute seule

- Modèle : `src/models/authorization/legacyIdentityStore.js`
  (`migrateLegacyIdentities`, dans une transaction).
- Service : `src/services/authorization/legacyIdentityMigration.js`.
- Branchement : `src/services/authorization/contextBootstrap.js`, sous le nom
  `legacy-identities-normalization-v1`, **après** la pose des rôles de base.
- Le nom est inscrit dans `authz_migrations` **seulement si la transaction
  réussit**. Un garde-fou dans la transaction annule tout si un ancien nom
  subsiste ou si une relation active n'a pas reçu sa carte.

Ordre imposé : écrire les cartes, **puis** changer l'identité. L'inverse ferait
perdre à la personne son profil par défaut dans le même instant.

Détail complet : `docs/permissions/LEGACY-IDENTITIES-MIGRATION.md`.

## 4. Compteurs

| Indicateur | Avant 8.6 | Après 8.6 |
|---|---:|---:|
| Comparaisons de rôle hors moteur | 294 | **263** |
| Exceptions figées du garde-fou rôles | 204 | **169** |
| Exceptions figées du garde-fou étendu | 22 | **21** |
| Actions en dette (sans déclaration) | 60 | **56** |
| Actions sans capacité (liste de travail) | 125 | **121** |
| Listes de rôles en dur dans les actions | 73 | **68** |
| Valeurs de connexion hors des trois identités | 5 | **0** |
| Périmètre programme vérifiant aussi la capacité | 31/32 | **32/32** |
| Appels à l'ancien contrôle venture | 0 | **0** |

## 5. Tests

- `npm run test:authz` → **12 suites / 79 tests** verts, cliquet respecté.
- Balayage large → 432 suites vertes ; les **17 suites en échec** sont
  exactement les préexistantes (vérifiées sur `HEAD` propre avant ce lot).
- Migration : 4 tests (ordre, deux garde-fous, liste des libellés), dont la
  famille `investor` désormais couverte.
- `npm run lint` → 0 erreur.

## 6. Procédure de production

L'application est hébergée sur Vercel ; la migration **n'est pas** lancée depuis
un script local. Elle s'applique au premier démarrage du nouveau déploiement.

1. **Avant de déployer** — coller
   `scripts/db-audit/legacy-identity-simulation.sql` dans l'éditeur SQL
   Supabase (lecture seule). Attendu sur la base réelle :

   | Famille | Personnes | Relations actives | Cartes à créer | Actives sans carte |
   |---|---:|---:|---:|---:|
   | participant | 563 | 563 | 563 | **0** |
   | facilitateur | 5 | 0 | 0 | **0** |
   | investisseur | 0 | 0 | 0 | **0** |
   | fondateur | 1 | 1 | 1 | **0** |

2. **Déployer.** Le démarrage exécute la migration une fois. Journal attendu :

   ```
   [authz] legacy identities normalized { updated: 569, cards: 564, withoutRelationship: 5 }
   ```

   Aucune ligne = rien à faire (base déjà migrée ou sans ancien libellé).

3. **Après le déploiement** — coller
   `scripts/db-audit/legacy-identity-verification.sql`. Attendu : migration
   enregistrée `1`, anciens rôles `0`, cartes `≈ 564`, sessions `3` (signalées).

4. **Purger les 3 sessions ouvertes** sous un ancien nom, pour qu'elles se
   reconnectent avec la nouvelle identité :

   ```sql
   DELETE FROM user_sessions
   WHERE expires_at > NOW()
     AND role IN ('participant', 'facilitator', 'investor', 'founder');
   ```

## 7. Retour arrière

- **Migration** : si elle échoue, rien n'est écrit ; elle retente au démarrage
  suivant. Après succès, remettre les rôles d'origine et fermer les cartes
  créées (`source = 'automatic'`, `notes = 'legacy-identity-migration'`) dans
  une transaction.
- **Vocabulaire** : `git revert` de ce lot. Les valeurs stockées restent
  lisibles ; aucune donnée n'est détruite.
- **Gestionnaire de programme** : `AUTHZ_PM_IDENTITY=role` sur le déploiement.

## 8. Compte rendu

```
LOT 8 — Un seul vocabulaire de connexion — étape 8.6
Fait :
  - quatre libellés retirés de la connexion ; fonction portée par le profil
  - écrivains normalisés avant l'écriture (inscription, import, approbation,
    inscription à un groupe)
  - migration de données automatique, transactionnelle, une fois par base
  - scripts d'audit de simulation et de vérification mis à jour (investisseur)
Compteurs : comparaisons 294 -> 263 ; exceptions 204 -> 169 ;
  valeurs de connexion legacy 5 -> 0 ; périmètre programme 32/32.
Divergences : aucune en mode ombre ; deux effets d'écran assumés (inscription
  en attente, atterrissage sur le profil).
Tests : 12 suites / 79 tests authz verts ; 432 suites vertes au total ;
  17 suites préexistantes en échec. Lint 0 erreur.
Décisions requises : aucune.
Retour arrière : AUTHZ_PM_IDENTITY=role, puis git revert.
Prochaine étape : retirer les quatre routes mortes une fois le journal
  [retired-route] silencieux, et solder la dette d'actions (121 -> 0).
```
