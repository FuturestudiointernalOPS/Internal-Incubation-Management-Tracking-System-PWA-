# Sprint 01 — Operations OS — Résumé d'ingénierie

> Source : `docs/Sprint_1_Operations_OS_Engineering_Specification_v1.0.pdf` (v1.0, p.3–17)
> Statut : Actif · Priorité : Élevée

## 0. Nature du sprint

**Pas** construire un nouveau système. Operations OS = fondation du Pilier 1, déjà largement implémentée. Objectif : **comprendre → tester → compléter → corriger**, sans redesign UI ni réécriture.

Build order : Operations OS doit être complet, stabilisé, validé **avant** tout autre OS (Program, Venture, Investor, CRM, Ecosystem).

## 1. Protocole obligatoire (avant tout code)

1. Revoir l'implémentation existante.
2. Tester le workflow actuel comme un utilisateur final.
3. Comparer le comportement avec cette spec.
4. Identifier : fait / partiel / manquant.
5. **Étendre** l'existant, jamais reconstruire.
6. Préserver la rétrocompatibilité.
7. Tests de régression avant soumission.
8. Ne pas redesigner l'UI sauf instruction explicite.

Réutiliser : APIs, composants, tables DB, services, utils, styles globaux, business logic. Éviter la duplication.

## 2. Standards globaux

| # | Standard | Règle |
|---|---|---|
| 4.1 | **Multilingue (obligatoire)** | Chaque page/modal/composant/notif/email/message de validation/label doit exister en **EN + FR**. Non terminé tant que FR absent. |
| 4.2 | **Champs de date standard** | `Start Date` + `End Date` uniquement. Sync auto avec Calendar. Interdit : "Finish Date", "Due Date", "Deadline" (sauf workflow métier explicite). |
| 4.3 | **UI existante** | Pas de redesign. Réutiliser layouts, design system, typo, spacing, couleurs. |
| 4.4 | **Architecture existante** | Réutiliser APIs/services/tables/composants. Créer du neuf seulement si rien de convenable. |
| 4.5 | **Rétrocompatibilité** | Aucun workflow existant ne doit casser. Régression testée obligatoire. |

## 3. Les 5 modules

| Module | Objet | Contenu |
|---|---|---|
| **M1 — Personal Work Management** | Espace de travail quotidien individuel | Tâches & sous-tâches, assignation, sync calendrier, notifications, pièces jointes, commentaires |
| **M2 — Weekly Accountability** | Cycle hebdo planification/revue/reporting | Standups, Retros, blockers, carry-over, rapports, métriques |
| **M3 — Project Operations** | Exécution collaborative multi-personnes | Création projet, gestion équipe, tâches projet, timeline, progression, reporting |
| **M4 — Communication & Collaboration** | Communication interne contextuelle | DM, discussions tâche/projet, broadcasts, annonces, notifications |
| **M5 — Operational Administration** | Supervision, gouvernance, reporting | Gestion équipe, reporting interne, métriques, finance, gestion documentaire |

## 4. Workflow opérationnel continu (le cycle hebdo)

- **Lundi** : login → système vérifie s'il existe un Weekly Standup pour la semaine courante. Existe → ouvre. Sinon → prompt "Create Weekly Standup".
  - **Règle** : 1 user = 1 Weekly Standup = 1 semaine opérationnelle. Pas de standup multiple pour le même user/même semaine.
- **Planning** : dans le standup, user crée tâches/sous-tâches, assigne, priorité, catégorie, Start/End Date. Toute tâche de la semaine appartient au standup de cette semaine.
- **Assignation** : tâche personnelle OU assignée à un user autorisé (respecte permissions groupe/projet/user). Le destinataire doit **Accept ou Decline**. Tant que non accepté → pending.
- **Pendant la semaine** : éditer, créer, mettre à jour progression, commenter, collaborer, joindre docs/URLs, replanifier. Création jamais restreinte au lundi.
- **Weekly Review (Retro)** : affiche toutes les tâches du standup de la semaine. Par tâche, 2 actions primaires : **Mark Task Completed** ou **Raise a Blocker**.
- **Blocker** : ne pas marquer complété → "Add Blocker" ouvre un modal (Title, Description, Reason, Priority, Reference URL optionnelle, Notes). Après soumission : blocker attaché à la tâche, tâche reste incomplète, Super Admin notifié, superviseur notifié. Reste actif jusqu'à résolution.
  - **Règle** : seul le créateur du blocker peut le marquer résolu.
- **Résolution** : owner du blocker retourne au Retro → "Mark Blocker as Resolved". Tâche complétable seulement après résolution.
- **Complétion tâche** : système vérifie les blockers actifs. Aucun → complétée. Blockers actifs → confirmation individuelle de chacun ; si un seul non résolu → complétion bloquée.
- **Parent Tasks** : sous-tâches complétables indépendamment. Parent complétable seulement quand **toutes** les sous-tâches requises sont complétées **et** tous les blockers actifs résolus.

## 5. M1 — Feature Breakdown (contexte de la sous-tâche 1.4)

| # | Feature | Contenu |
|---|---|---|
| 1.1 | Personal Dashboard | Standup courant, My Tasks, Assigned Tasks, résumé calendrier, notifs, projets assignés, activité récente |
| 1.2 | Personal Task Management | Create/Edit/Archive/Delete (permission), Duplicate, Task History |
| 1.3 | Subtask Management | Create/Edit/Delete/Complete sous-tâche, relation parent |
| **1.4** | **Task Assignment** | **Assign Task/Subtask · Accept/Decline · Assignment History · Reassignment** |
| 1.5 | Categories & Priorities | Catégories configurables · Priorités : Critical, High, Medium, Low |
| 1.6 | Calendar Integration | Start/End Date · MAJ auto calendrier |
| 1.7 | Notifications | Assignment/Accept/Decline, rappels échéance, retard, mentions, commentaires |
| 1.8 | Attachments & Reference Links | Upload fichiers/images · URLs (GitHub, Docs, Figma, Vercel, Jira…) |
| 1.9 | Comments & Activity History | Commentaires, mentions, timeline, historique d'édition |

## 6. Règles métier M1

1. 1 user = 1 espace personnel.
2. Tâches créables à tout moment de la semaine.
3. Sous-tâches illimitées par tâche.
4. Assignation seulement à des users autorisés.
5. User assigné doit **accepter ou refuser**.
6. **Historique d'assignation préservé**.
7. Chaque tâche appartient à exactement 1 Weekly Standup.
8. Chaque tâche : Title, Description, Category, Priority, Start Date, End Date.
9. Changement Start/End Date → MAJ auto calendrier.
10. Upload fichiers + URLs de référence.
11. Commentaires + mentions.
12. Tout user-facing en EN + FR.

## 7. Ticket 1.4 — Task Assignment Workflow (cible de cette itération)

> Améliorer le workflow d'assignation. **Aucune tâche ne devient la responsabilité d'un autre user sans acceptation.**

**Critères d'acceptation :**
- ☐ La notification d'assignation fonctionne.
- ☐ Le workflow Accept fonctionne.
- ☐ Le workflow Decline fonctionne.
- ☐ L'historique d'assignation est préservé.
- ☐ (implicite 4.1) EN + FR.
</content>
