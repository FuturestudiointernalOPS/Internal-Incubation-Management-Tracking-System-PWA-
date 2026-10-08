# Couloir communications — L8, B1, B6

## Périmètre des contrôleurs

| Fichier | Service ou dépôt utilisé |
| --- | --- |
| `src/app/api/campaigns/route.js` | `communications/campaigns` ; dépôt `models/communications` pour les lectures simples |
| `src/app/api/campaigns/[id]/route.js` | `communications/campaigns` ; dépôt `models/communications` pour la suppression |
| `src/app/api/internal-comms/route.js` | `communications/internalComms` |
| `src/app/api/announcements/route.js` | `communications/announcements` |
| `src/app/api/followups/route.js` | `communications/followups` ; dépôt `models/communications` pour la liste |
| `src/app/api/events/route.js` | `communications/events` ; dépôt `models/communications` pour la liste |
| `src/app/api/notifications/route.js` | `communications/inboxNotifications` |
| `src/app/api/notifications/venture/route.js` | `communications/ventureNotifications` |
| `src/app/api/notifications/overdue/route.js` | `communications/notifications` |
| `src/app/api/notifications/due-reminders/route.js` | `communications/notifications` |

Les routes conservent l'authentification, les validations d'entrée et les réponses
HTTP. Les services portent les décisions et les enchaînements de lectures/écritures.
Les contrôles de secret des routes cron restent à la frontière HTTP.

## Découpage

- `internalComms.js` conserve tous ses exports publics et délègue à
  `internal-comms/scope.js`, `inbox.js`, `send.js` et `read.js`.
- Les campagnes conservent les changements déjà présents lors de la reprise.
- `followups.js` décide de l'accès par affectation et équipe avant la modification.
  Il conserve aussi le comportement historique de mise à jour d'un identifiant absent.
- `inboxNotifications.js` orchestre les lectures tolérantes aux erreurs, le marquage
  « vu », le compte indépendant des non-lus et les modifications autorisées.
- `ventureNotifications.js` distribue les lectures et actions au service existant
  `services/ventures/notifications`, après contrôle du destinataire.
- `DashboardLayout.js` conserve son export public et l'orchestration ; les blocs
  `SidebarContent`, `ShellHeader` et les helpers de navigation sont dans `layout/shell/`.
- `MessagingChat.js` conserve son export public, les états, les effets et les actions ;
  la liste, le fil et la composition sont dans `messaging/chat/`.
- `models/communications.js` est un barillet de même surface au-dessus de
  `models/communications/` (`scope`, `messages`, `announcements`, `followups`,
  `campaigns`, `events`) ; le SQL est déplacé à l'identique.
- Le marquage lu est restreint au périmètre de visibilité de l'appelant :
  `updateMessagesReadByIds(messageIds, plan)` ré-applique le prédicat de la boîte
  de réception, donc un identifiant invisible met à jour zéro ligne.

Les fichiers `src/app/**/layout.js` et `src/components/dashboard/**` ne font pas
partie du changement. Les libellés de la coquille (invitation, affectation, thème)
sont passés par `t()` et les couleurs historiques `bg-slate-600`/`text-white` et
`text-slate-400` remplacées par les jetons du design system, sans changer la
structure des blocs. Le correctif de marquage lu est un changement de comportement
(la restriction de visibilité) ; le reste est sans régression d'affichage.
