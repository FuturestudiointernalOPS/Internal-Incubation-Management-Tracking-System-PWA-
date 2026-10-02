# Points à signaler au lead — Communications — Christelle

Date : 2 octobre 2026. Périmètre : L8, B1 et B6.

Ce document distingue les constats sur le code des résultats de validation.
Les points hérités ci-dessous n'ont pas été corrigés fonctionnellement : la
mission demandait un refactoring conservant le comportement et le rendu.
Le rapport complet est dans [RAPPORT_TECHNIQUE_COMMUNICATIONS_Christelle.md](RAPPORT_TECHNIQUE_COMMUNICATIONS_Christelle.md).

## 1. Priorité haute : propriété des messages marqués lus

**Constat vérifié par lecture du code, sans exploitation en environnement réel.**

Dans `src/services/communications/internal-comms/read.js`, `markMessagesRead`
contrôle la participation à une conversation lorsque `conversationWith` est
fourni. En revanche, la branche `messageIds` transmet directement les identifiants
à `markMessagesReadByIds`.

Dans `src/models/communications.js`, cette fonction exécute une mise à jour
filtrée uniquement par les identifiants :

```sql
UPDATE v2_messages SET is_read = 1 WHERE id IN (...)
```

La requête n'est pas filtrée par le destinataire ou par la visibilité du message.
La route impose bien une session et la capacité `messaging/view`, mais ces gardes
ne constituent pas une vérification de propriété de chaque identifiant.

**Risque à examiner :** une personne autorisée à utiliser la messagerie pourrait
marquer lus des messages qui ne lui sont pas visibles en transmettant leurs
identifiants. L'accessibilité réelle dépend des contrôles et des données de
l'environnement ; aucun essai offensif n'a été effectué.

**Origine :** comportement préexistant, conservé lors de l'extraction.

**Action proposée au lead :** ouvrir une correction dédiée, définir les règles
pour les messages directs, les groupes, les programmes et les super administrateurs,
puis introduire un filtrage de visibilité/propriété dans le service et le dépôt.
Le dépôt SQL est hors du périmètre exclusif de cette mission.

## 2. Validation finale encore nécessaire avant intégration

| Vérification | Résultat effectivement observé |
| --- | --- |
| Comparaison du JSX avant/après extraction | Identique pour le rendu de `DashboardLayoutInner` et `MessagingChat` après réintégration des blocs extraits |
| `npm run lint` | 0 erreur, 5 avertissements hors périmètre lors de la première exécution ; changements ultérieurs non intégralement revalidés |
| Première exécution de `npm test` | 248 suites réussies, 3 échouées ; 3 658 tests réussis, 5 échoués |
| Nature des échecs | Assertions structurelles recherchant les gardes ou blocs UI dans les anciens fichiers |
| Adaptation des assertions | Effectuée dans les trois fichiers concernés |
| Tests supplémentaires d'orchestration | Écrits ; résultat final non confirmé |
| Relance complète des tests | Résultat non récupéré après interruption ; ne pas considérer la relance comme réussie |
| `npm run build` | Lancé, arrivée à la compilation de production observée ; résultat final non confirmé |
| `git diff --check` | Aucun problème de whitespace détecté lors du contrôle documentaire |
| Vérification dans un navigateur | Non effectuée |
| Production test | Non effectué ; aucune promotion `G` → `main` réalisée |

**Action proposée :** relancer les tests, le lint et le build sur l'état final ;
puis vérifier les parcours UI et les permissions. La comparaison du JSX ne
remplace pas les essais de navigation, de survol, de responsive et d'interaction.
Le chantier ne doit pas être présenté comme entièrement validé à ce stade.

## 3. Textes et styles hérités dans la coquille

Des textes visibles restent en anglais hors `t()`, notamment :

- `Project Invitation` et `Task Assignment` dans `DashboardLayout.js` ;
- les libellés `System`, `Dark`, `Light` dans `shell/ShellHeader.js` ;
- plusieurs actions et formulations associées aux invitations et affectations.

Certaines classes historiques restent également présentes, par exemple
`bg-slate-600` et `text-white` sur des boutons. Leur conformité doit être évaluée
selon l'usage exact et les exceptions du design system.

**Origine :** textes et classes déjà présents, déplacés ou conservés sans changement.

**Action proposée :** traiter la mise en conformité i18n/thème dans une tâche
dédiée avec traductions anglaises et françaises et vérification visuelle. Elle
modifierait potentiellement le rendu, contrairement à la mission B1 actuelle.

## 4. Couverture structurelle fragile aux déplacements

Trois suites recherchaient du code directement dans le fichier historique :

- `identity-gate-bridge.test.js` : garde d'affectation de la route des suivis ;
- `sidebar-menu.test.js` : expansion des sections et garde de survol ;
- `notification-badge.test.js` : aperçu limité et rafraîchissement à l'ouverture.

Les assertions ont été adaptées aux nouveaux emplacements sans supprimer les
contrats protégés. Des tests d'orchestration ont aussi été ajoutés sur les refus
avant écriture et sur les comptes de notifications.

**Action proposée :** maintenir les contrats de sécurité, mais privilégier
progressivement des tests de comportement aux recherches de chaînes dans les
sources pour les interactions les plus sensibles.

## 5. Campagnes désactivées

Les deux routes de campagnes conservent `RETIRED = true` et une réponse de refus
403. Le travail déjà présent de Claude sur leurs services a été conservé.

**Conséquence :** tester un service de campagne ne prouve pas que le parcours
HTTP de campagne est actif. Ce refactoring ne réactive pas les campagnes.

**Action proposée :** toute réactivation doit être une décision produit et une
tâche distincte, avec validation du parcours HTTP et des droits.

## 6. Suivi inexistant : succès historique conservé

`updateScopedFollowup` conserve la mise à jour même lorsque la lecture préalable
ne trouve aucun suivi. Le dépôt met alors à jour zéro ligne et le contrôleur
renvoie un succès, comme auparavant.

**Action proposée :** décider séparément si un identifiant absent doit produire
404. Aucun changement de contrat n'a été introduit dans ce chantier.

## 7. Coordination et limites du périmètre

- Aucun fichier `src/app/**/layout.js` n'a été modifié.
- Aucun composant de `src/components/dashboard/**` n'a été modifié.
- Les exports publics des deux composants principaux sont conservés.
- Aucune requête SQL, migration, configuration de dépendances ou locale n'a été modifiée.
- Les appels historiques `initDb` présents dans certaines routes restent en place :
  aucun nouveau SQL n'a été introduit dans les services, mais l'interdiction
  littérale des imports de `@/lib/db` n'est pas encore satisfaite par toutes ces routes.
- Les fichiers de documentation partagés `DESIGN_SYSTEM.md` et `docs/LAYER_SPLIT.md`
  ont reçu une section courte sur le découpage ; leurs modifications doivent être
  coordonnées avec les autres travaux lors de l'intégration.
- Les modifications de tests sont complémentaires au périmètre métier et doivent
  être incluses dans la revue ; elles ne constituent pas une nouvelle fonctionnalité.

Aucun commit, merge, déploiement ou envoi externe de ce rapport n'a été effectué.
