# Étape 3 — contextes membres pilotés par les profils

Statut : **implémenté le 2026-11-12**. Le changement est additif : aucune porte
existante n'est retirée.

## Ce qui change

Le menu personnel d'un membre était composé uniquement à partir de ses
**relations** (inscription à un programme, appartenance à une venture, cours
suivi, profil investisseur approuvé). Il tient désormais compte aussi des
**profils actifs** que le serveur a résolus.

| Contexte | Signal qui l'ouvre | Portes |
|---|---|---|
| Investisseur | profil `investor` **ou** relation investisseur | espace investisseur + deal flow ; remplace l'accueil générique |
| Apprenant | profil `learner` **ou** cours suivi | My Learning |
| Participant | profil `participant` **ou** relation programme | My Programs + My Certificates |
| Facilitateur | profil `facilitator` | My Programs + My Reviews |
| Fondateur | profil `founder` **ou** relation fondateur | accueil fondateur + réunions |
| Membre de venture | relation venture (inchangé) | My Ventures |

Le profil `facilitator` est le nouveau contexte ajouté : auparavant, un
facilitateur ne voyait pas ses portes dans le menu personnel, même lorsqu'il
détenait le profil.

## Comment les profils arrivent au menu

Le shell lit déjà les profils actifs via le provider de permissions. Ils sont
maintenant transmis à la composition du menu personnel :

```
DashboardLayout (activeProfiles)
      ↓
useDashboardNavigation (profiles)
      ↓
composeMemberNav (profiles)
      ↓
activeMemberContexts (profiles)
```

Si la lecture des profils n'a pas encore répondu, la liste est vide : le menu
reste celui des relations, puis les portes de profil apparaissent dès que la
réponse arrive. Aucune porte n'est retirée pendant ce délai.

## Ce qui ne change pas

- Les règles de relation existantes restent la source des contextes.
- Les portes de venture restent fondées sur l'appartenance réelle.
- Le mode « menu dérivé des droits » du personnel et du propriétaire reste
  derrière son drapeau.
- Un membre sans profil et sans relation garde le tableau de bord seul.

## Validation

- `member-contexts.test.js` : contextes et composition, **26 tests passés**.
- Suite navigation + shell : **84 tests passés** sur 5 suites.
- ESLint : **0 erreur**.
