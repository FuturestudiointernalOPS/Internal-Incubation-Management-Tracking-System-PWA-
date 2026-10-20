# Lot 7 — étape 7.4 : D-8, le mode de messagerie vient du profil

> Date : 2026-10-20. Le même gestionnaire obtient le même périmètre de
> messagerie, qu'il ouvre l'inbox depuis la cloche, la barre latérale ou un lien
> direct.

---

## 1. Le problème

Deux pages rendent le même composant, avec un rôle différent :

| Page | `role` passé au chat | Composition |
|---|---|---|
| `/pm/messages` | `program_manager` | contacts des programmes gérés |
| `/staff/messages` | `staff` | tout contact actif |
| `/participant/messages` | `participant` | participants du même groupe |

Depuis D-1, un gestionnaire de programme est `staff` : la cloche et le hub CRM
l'envoient vers `/staff/messages`. Le **périmètre suivait donc l'URL**, pas la
fonction — un même gestionnaire avait deux périmètres selon la porte.

## 2. La correction

`resolveMessagingRole({ sectionRole, profiles, isSuperAdmin })`
(`src/components/messaging/chat/messagingMode.js`) répond une seule fois :

```
super administrateur                    → super_admin
profil program_manager                   → program_manager
sinon                                    → rôle de la section (l'URL)
```

`MessagingChat` lit `profiles` et `isSuperAdmin` depuis `PermissionProvider`
(déjà chargé par la coque) et transmet ce mode aux règles de portée. La page ne
décide plus rien.

Le rôle de section reste le repli, ce qui préserve trois cas :

- l'inbox d'un membre (`participant`) ;
- le **retour arrière D-1** (`AUTHZ_PM_IDENTITY=role`) : une session
  `program_manager` n'a pas le profil mais garde son mode ;
- les comptes d'entité.

## 3. Effet

| Situation | Avant | Après |
|---|---|---|
| Gestionnaire depuis la cloche (`/staff/messages`) | tout le répertoire | programmes gérés |
| Gestionnaire depuis `/pm/messages` | programmes gérés | inchangé |
| Gestionnaire depuis `/participant/messages` | participants du groupe | programmes gérés |
| Personnel sans profil | tout le répertoire | inchangé |
| Super administrateur | inbox d'administration | inchangé |

Aucune route ne change de destination : c'est le **mode** qui suit la fonction.

## 4. Tests

`src/__tests__/messaging-mode.test.js` — 6 tests : propriétaire de la
plateforme, profil sur la route staff, profil sur la route participant, staff
sans profil, membre, retour arrière D-1.

`npm run test:authz` → **11 suites / 74 tests** verts. Lint : 0 erreur,
261 avertissements (inchangés).

## 5. Retour arrière

`git revert` : les pages repassent leur rôle au chat, comme avant. Aucune
écriture en base.

## 6. Compte rendu

```
LOT 7 — D-8, le mode de messagerie — étape 7.4
Fait :
  - resolveMessagingRole : profil d'abord, section ensuite
  - MessagingChat lit le profil résolu au lieu de croire la page
Compteurs : inchangés (294 comparaisons, 182 exceptions, 56 dette).
Divergences : aucune — D-8 est refermée comme recommandé.
Tests : 6 ajoutés ; 11 suites / 74 tests authz verts. Lint 0 erreur.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : la migration des identités legacy, après confirmation de la
  base à auditer.
```
