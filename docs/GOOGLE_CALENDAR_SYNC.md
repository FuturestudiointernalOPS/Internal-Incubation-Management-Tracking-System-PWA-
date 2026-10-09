# Intégration Google Calendar — tous les rôles

Branche `google-calendar-sync` (créée depuis `dashboard_refactoring_front`), 2026-10-08.
Ouverte à **tous les rôles et tous les utilisateurs** (branche `A`, 2026-10-09).

Chaque utilisateur connecté peut relier son compte Google, depuis la **carte
« Google Calendar » de sa page profil** (ou depuis la barre d'outils du calendrier
du tableau de bord admin). Ses tâches datées **et ses objets horaires** (sessions
de programme, rendez-vous de coaching) sont copiés dans son Google Calendar, et
les événements qu'il ajoute côté Google **dans l'agenda Future Studio**
apparaissent sur le tableau de bord. Ses rendez-vous personnels ne sont jamais lus.

---

## 1. Le principe : un agenda dédié « Future Studio »

La demande imposait deux règles :

1. on ne synchronise **que** ce qui concerne Future Studio ;
2. tout le reste du Google Calendar de l'utilisateur doit être **ignoré**.

Filtrer par mot-clé dans l'agenda principal aurait obligé à **lire tout
l'agenda personnel**, puis à trier. C'est fragile : un mot-clé oublié et un
rendez-vous privé arrive sur la plateforme.

On fait donc l'inverse, et c'est Google qui garantit le filtre :

- l'application demande uniquement le scope OAuth
  **`https://www.googleapis.com/auth/calendar.app.created`** (plus
  `openid email`, pour afficher le compte relié) ;
- avec ce scope, l'application ne peut accéder **qu'aux agendas qu'elle a
  créés elle-même**. Google lui interdit de lire l'agenda principal ou
  tout autre agenda personnel ;
- à la connexion, l'application crée dans le compte Google un agenda
  secondaire nommé **« Future Studio »**. C'est le seul périmètre de la
  synchronisation.

Résultat :

| Sens | Ce qui passe | Ce qui ne passe jamais |
|---|---|---|
| Plateforme → Google | les tâches datées de l'utilisateur (créées par lui ou qui lui sont assignées), dans l'agenda « Future Studio » | les tâches des autres membres |
| Google → plateforme | les événements que l'utilisateur ajoute **dans l'agenda « Future Studio »** | tout événement d'un autre agenda (perso, travail, anniversaires…) : inaccessible au niveau OAuth |

Pour ajouter un rendez-vous Future Studio depuis Google, l'utilisateur le crée
dans l'agenda « Future Studio » (sélecteur d'agenda de Google Calendar). Il
apparaît alors sur le tableau de bord, en bleu ciel.

---

## 2. Base de données

Migration : `src/migrations/050_google_calendar_sync.sql`. Le même schéma est créé
à l'exécution par `ensureGoogleCalendarSchema()` dans
`src/models/integrations/googleCalendar.js`, sauf si
`SKIP_RUNTIME_SCHEMA_MAINTENANCE=true` (dans ce cas, appliquer la migration à la main). Les
changements sont purement additifs : 4 nouvelles tables (`google_calendar_connections`,
`google_calendar_task_links`, `google_calendar_events` et
`google_calendar_event_links` pour les objets horaires), aucune table existante
modifiée.

### `google_calendar_connections` — une ligne par utilisateur relié

| Colonne | Rôle |
|---|---|
| `user_id` (PK) | `cid` de l'utilisateur (session) |
| `google_email` | affichage uniquement |
| `calendar_id` | id de l'agenda « Future Studio » créé chez Google |
| `refresh_token_enc` | **refresh token chiffré** (AES-256-GCM) |
| `access_token_enc`, `access_token_expires_at` | access token chiffré (cache ~1 h) |
| `scope` | scopes réellement accordés |
| `sync_token` | jeton de synchro incrémentale Google |
| `channel_id`, `channel_token_hash`, `channel_resource_id`, `channel_expires_at` | canal de notifications push (webhook). Le secret est stocké **haché** (SHA-256) |
| `last_synced_at`, `last_error` | état affiché dans l'UI (`revoked`, `syncFailed`) |

### `google_calendar_task_links` — tâche → événement Google

`(user_id, task_id)` → `google_event_id` + `fingerprint` (hash du dernier
contenu envoyé). Si l'empreinte n'a pas changé, aucun appel n'est fait à Google.

### `google_calendar_events` — événements lus depuis l'agenda Future Studio

`(user_id, google_event_id)`, titre, description, lieu, `start_date` /
`end_date` (fin **incluse**), `start_at` / `end_at` pour les événements à
heure, `all_day`, `html_link`.

### Sécurité des jetons

- Le refresh token donne un accès durable à l'agenda. Il faut le renvoyer à
  Google, donc on ne peut pas le hacher : il est **chiffré** avec AES-256-GCM
  (`src/lib/integrations/google/tokenCrypto.js`). Ce mode protège à la fois le
  secret et l'intégrité de la donnée (toute altération est refusée). Un IV
  aléatoire est utilisé à chaque chiffrement.
- La clé n'existe que dans l'environnement serveur :
  `GOOGLE_TOKEN_ENCRYPTION_KEY` (32 octets en base64 ou hex). Une lecture
  directe de la base ne suffit donc pas pour utiliser les jetons.
- Format stocké : `v1:<iv>:<tag>:<chiffré>`. Le préfixe `v1` permettra de
  changer de clé ou d'algorithme plus tard.
- Les jetons ne quittent jamais le serveur : l'API de statut indique seulement
  si une connexion existe.
- La déconnexion **révoque** le jeton chez Google, puis supprime les trois
  types de lignes de l'utilisateur.

---

## 3. Backend

L'architecture suit les couches MVC du projet (`docs/LAYER_SPLIT.md`) :

| Couche | Fichier | Contenu |
|---|---|---|
| Infra | `src/lib/integrations/google/oauth.js` | URL de consentement, échange du code, refresh, révocation |
| Infra | `src/lib/integrations/google/calendarApi.js` | appels REST Calendar v3 (`fetch`, sans SDK) |
| Infra | `src/lib/integrations/google/tokenCrypto.js` | chiffrement AES-256-GCM |
| Modèle | `src/models/integrations/googleCalendar.js` | tout le SQL des 3 tables + lecture des tâches à synchroniser |
| Service | `src/services/integrations/googleCalendar/mapping.js` | règles pures : tâche → événement, reconnaissance de nos copies, plan créer/modifier/supprimer |
| Service | `src/services/integrations/googleCalendar/index.js` | cas d'usage : connexion, synchro, webhook, cron, statut, déconnexion |
| Contrôleurs | `src/app/api/integrations/google-calendar/**/route.js` | auth, appel du service, réponse |

### Endpoints

| Méthode et route | Accès | Rôle |
|---|---|---|
| `GET /api/integrations/google-calendar` | utilisateur connecté | statut : `configured`, `connected`, `email`, `lastSyncedAt`, `lastError`, `realtime` |
| `DELETE /api/integrations/google-calendar` | utilisateur connecté | déconnexion (stop du canal, révocation, effacement) |
| `GET /api/integrations/google-calendar/connect` | utilisateur connecté | démarre OAuth2 : cookie `state` httpOnly (10 min) + cookie `next`, puis redirection vers Google |
| `GET /api/integrations/google-calendar/callback` | utilisateur connecté | vérifie le `state`, échange le code, chiffre et stocke, crée l'agenda, lance la 1re synchro, redirige vers la **page d'origine** `?gcal=<résultat>` |
| `POST /api/integrations/google-calendar/sync` | utilisateur connecté | bouton « Synchroniser maintenant » ; avec `?ifStale=1`, ne fait rien si la dernière synchro a moins de 5 min (appel au chargement) |
| `GET /api/integrations/google-calendar/events` | utilisateur connecté | événements de l'agenda Future Studio, au format du calendrier du tableau de bord |
| `POST /api/integrations/google-calendar/webhook` | Google (sans session) | notifications push ; authentifié par `X-Goog-Channel-Token`. **Doit figurer dans `publicApiPaths` de `src/proxy.js`** |
| `GET` ou `POST /api/integrations/google-calendar/cron` | secret `CRON_SECRET` | synchro de toutes les connexions et renouvellement des canaux. **Doit figurer dans `publicApiPaths` de `src/proxy.js`** |

### Flux OAuth2

1. Clic sur « Intégrer son Google Calendar » → `/connect` génère un `state`
   aléatoire, le pose en cookie httpOnly et redirige vers Google, avec
   `access_type=offline` et `prompt=consent` pour obtenir un refresh token.
2. Google renvoie vers `/callback?code&state`. Si le `state` ne correspond pas
   au cookie, la requête est refusée (protection CSRF).
3. Le code est échangé **côté serveur** : le client secret ne va jamais au
   navigateur. Les scopes accordés sont vérifiés : si l'utilisateur a décoché
   l'accès à l'agenda, rien n'est connecté.
4. Les jetons sont chiffrés et stockés. L'agenda « Future Studio » est créé.
   Une première synchro est lancée.
5. Retour sur `/admin?gcal=connected`. Le tableau de bord affiche un message
   via `useDialogs()` puis nettoie l'URL.

### Synchronisation

**Plateforme → Google** (`pushTasks`)
- Tâches concernées : `tasks` où `user_id = cid` ou `assigned_to = cid`, avec
  au moins une date, et qui ne sont pas terminées depuis plus de 90 jours
  (500 au maximum).
- Une tâche devient un événement **sur la journée entière**, du début à la
  fin. La fin est exclusive chez Google, d'où le +1 jour. Une tâche terminée
  est préfixée « ✓ ». L'événement est marqué « disponible » pour ne pas
  bloquer l'agenda de l'utilisateur.
- Chaque copie porte un marqueur privé
  `extendedProperties.private = { fs_source: "impactos", fs_task_id }`.
- `planTaskSync` compare les tâches et les liens existants : il crée les
  nouvelles, modifie celles dont l'empreinte a changé et supprime celles qui
  sortent du périmètre.
- La plateforme est la **source de vérité** pour les tâches. Une copie
  supprimée à la main dans Google est recréée. Une modification faite dans
  Google sur une copie de tâche n'est pas reportée sur la tâche.

**Google → plateforme** (`pullEvents`)
- `events.list` sur l'agenda Future Studio, avec un `syncToken` : seuls les
  changements sont relus, suppressions comprises.
- Les événements qui portent notre marqueur (nos copies de tâches) sont
  ignorés. Les autres sont enregistrés dans `google_calendar_events`.
  Les événements annulés sont supprimés.
- Une réponse `410 Gone` (jeton de synchro expiré) déclenche une relecture
  complète.

**Ce qui déclenche une synchro**
1. La connexion (première synchro).
2. Le bouton « Synchroniser maintenant ».
3. Le chargement du tableau de bord, si la dernière synchro a plus de 5 min.
4. Le **webhook** : Google prévient dès que l'agenda Future Studio change, et
   on relit alors les événements. Le canal (`events.watch`) n'est ouvert que si
   l'application est servie en **HTTPS public** : en local, ce sont les points
   3 et 5 qui prennent le relais. On peut désactiver le webhook avec
   `GOOGLE_CALENDAR_WEBHOOKS=off`.
5. Le **cron** (`/cron`) synchronise tout le monde dans les deux sens. Il
   renouvelle aussi les canaux push, que Google limite à 7 jours, au moins
   24 h avant leur expiration.

**Robustesse**
- Une seule synchro à la fois par utilisateur et par processus. Si webhook,
  cron et bouton arrivent en même temps, le deuxième appel attend le premier.
- Si l'utilisateur supprime l'agenda « Future Studio » dans Google, les liens
  sont remis à zéro et l'agenda est recréé à la synchro suivante.
- Si l'accès a été révoqué chez Google (`invalid_grant`), `last_error =
  "revoked"` et le bouton devient « Reconnecter Google Calendar ».

---

## 4. Frontend

**Emplacement du bouton** : **une seule fois, dans l'en-tête partagé**
(`ShellHeader`), à côté du sélecteur de contexte. Le même contrôle sert donc
**tous les rôles** ; le tableau de bord admin ne le répète plus dans sa barre
d'outils (il ne garde que le flux d'événements et la légende).

| État | Affichage |
|---|---|
| non configuré (variables d'env absentes) | bouton cliquable : le clic ouvre une fenêtre qui liste les variables manquantes (noms seulement, jamais de valeur) |
| non connecté | **« Intégrer son Google Calendar »** (FR) / « Connect Google Calendar » (EN) |
| connecté | pastille bleu ciel + e-mail du compte, bouton ⟳ « Synchroniser maintenant », bouton « Déconnecter » (confirmation `useDialogs`, tone `danger`) |
| accès révoqué | « Reconnecter Google Calendar » |
| tout rôle | voit le même contrôle dans l'en-tête (les événements Google ne s'affichent que sur le calendrier admin) |

Les événements Google apparaissent dans le calendrier et dans le widget
« Upcoming », en **bleu ciel**, avec une entrée « Google Calendar » dans la
légende. Un clic sur l'un d'eux ouvre l'événement dans Google Calendar (nouvel
onglet) au lieu du panneau de tâche.

Fichiers :
- `src/components/integrations/useGoogleCalendar.js` — hook **partagé** (déplacé depuis `src/app/admin/hooks/`) : statut, événements (optionnels), connexion, synchro, déconnexion, message de retour d'OAuth. L'annonce du retour OAuth est **unique** par chargement (en-tête et tableau de bord admin coexistent).
- `src/components/integrations/GoogleCalendarConnect.js` — le contrôle compact, monté **une fois** dans l'en-tête partagé : visible par **tous les rôles**.
- `src/components/layout/shell/ShellHeader.js` — affiche le contrôle ; le tableau de bord admin ne le répète plus dans sa barre d'outils.
- `src/components/staff/StaffCalendar.js` — le calendrier partagé gagne 3 props **optionnelles** : `headerAction` (emplacement dans la barre d'outils), `extraLegend` (entrée « Google Calendar » dans la légende) et `onOpenExternal` (un élément hors plateforme ouvre Google, jamais le panneau). Sans elles, l'affichage des calendriers staff/participant est identique.
- `src/components/staff/calendarModel.js` — `SOURCE_KIND` gagne `google: "meeting"` : une entrée Google se dessine comme un événement de calendrier.
- `src/components/staff/staff.css` — les jetons `--stf-google*` et le style `.x-it.g` / `.x-ab.g`.
- `src/app/admin/hooks/useAdminCalendar.js` — paramètre **optionnel** `externalItems` (vide par défaut), converti par `googleEventsToEvents` et fusionné dans le flux du calendrier uniquement.
- `src/components/admin/dashboard-page/calendarEvents.js` — `googleEventsToEvents` : une entrée Google, un événement par jour.
- `src/app/admin/hooks/useAdminWidgetData.js` — paramètre **optionnel** `externalItems` (vide par défaut), fusionné dans le widget « Upcoming ». Les compteurs de tâches ne changent pas.
- `src/app/admin/page.js` — branchement, `selectCalendarItem` (widget) et `openCalendarExternal` (calendrier).
- i18n : domaine dédié `googleCalendar.*` dans `src/locales/{en,fr}/googleCalendar.json`.

Les règles d'affichage du calendrier (ordre de création, pas de doublon, pas de
compteur ×N) restent valables : le widget « Upcoming » passe par le même
`groupSameTitle`, et le calendrier partagé déduplique ses propres éléments.

---

## 5. Mise en place (Google Cloud et variables d'environnement)

1. **Google Cloud Console** → créer un projet (ou réutiliser celui de Future Studio).
2. *APIs & Services → Library* → activer **Google Calendar API**.
3. *OAuth consent screen* :
   - type *External* (ou *Internal* si les comptes sont dans un Google Workspace Future Studio) ;
   - ajouter les scopes `openid`, `email` et `.../auth/calendar.app.created` ;
   - tant que l'application est en mode *Testing*, ajouter les comptes testeurs.
4. *Credentials → Create OAuth client ID* → type **Web application** :
   - *Authorized redirect URIs* :
     - `http://localhost:3000/api/integrations/google-calendar/callback` (dev)
     - `https://<staging>/api/integrations/google-calendar/callback`
     - `https://impactos.futurestudio.bj/api/integrations/google-calendar/callback` (prod)
5. Variables d'environnement, sur le serveur uniquement et **jamais commitées** :

```bash
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
GOOGLE_TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)   # NE PLUS CHANGER ensuite
# optionnelles
GOOGLE_REDIRECT_URI=https://…/api/integrations/google-calendar/callback  # sinon APP_URL + chemin
GOOGLE_CALENDAR_TIMEZONE=Africa/Porto-Novo
GOOGLE_CALENDAR_WEBHOOKS=off        # pour couper les notifications push
CRON_SECRET=…                       # déjà utilisé par les autres tâches planifiées
```

   Si `GOOGLE_TOKEN_ENCRYPTION_KEY` change, les jetons déjà stockés deviennent
   illisibles : chaque utilisateur doit alors se reconnecter.
6. **Cron** : appeler la route toutes les 15 min environ :

```bash
curl -X POST "$APP_URL/api/integrations/google-calendar/cron" -H "x-cron-secret: $CRON_SECRET"
```

   (Vercel Cron : `GET` avec `Authorization: Bearer $CRON_SECRET` fonctionne aussi.)
7. **Webhook** : en production (HTTPS), rien à configurer. Le canal s'ouvre
   tout seul à la première synchro. Google peut exiger que le domaine soit
   vérifié dans la Search Console.
8. Production avec `SKIP_RUNTIME_SCHEMA_MAINTENANCE=true` : appliquer
   `src/migrations/050_google_calendar_sync.sql`.

---

## 6. Tests

Tests automatiques : `src/__tests__/google-calendar-sync.test.js`. Ils couvrent
les dates (fin exclusive, changement de mois et d'année), la conversion d'une
tâche en événement, le plan créer/modifier/supprimer, la reconnaissance de nos
copies, la normalisation des événements Google et le chiffrement (aller-retour,
IV unique, refus d'un chiffré altéré, refus sans clé).

Résultats :
- `npm test` : 350 suites et 7040 tests réussis ;
- lint : 0 erreur, aucun nouvel avertissement sur les fichiers modifiés ;
- `npm run i18n:parity` : 0 clé manquante ;
- `npm run build` : OK.

### À tester à la main (avant le push)

1. **Sans variables Google** : un clic sur « Intégrer son Google
   Calendar » ouvre une fenêtre qui liste les variables manquantes ; le calendrier fonctionne comme avant.
2. Avec les variables : clic → écran Google → accepter → retour sur `/admin`
   avec le message « Google Calendar connecté ».
3. Dans Google Calendar : un agenda **« Future Studio »** existe et contient
   les tâches datées (sur la journée entière, du début à la fin).
4. Créer un événement dans **l'agenda principal** Google → il **n'apparaît
   pas** sur le tableau de bord, même après « Synchroniser maintenant ».
5. Créer un événement dans **l'agenda « Future Studio »** → après
   synchronisation, il apparaît en bleu ciel. Un clic l'ouvre dans Google.
6. Modifier la date d'une tâche sur la plateforme → « Synchroniser » →
   l'événement Google est déplacé.
7. Terminer une tâche → l'événement Google devient « ✓ … ».
8. Refuser l'accès sur l'écran Google → message « Connexion annulée ».
9. « Déconnecter » → confirmation → le bouton revient. Sur
   https://myaccount.google.com/permissions, l'application n'a plus d'accès.
10. Se connecter en staff → aucun bouton Google dans le calendrier.

---

## 7. Limites connues et suites possibles

- Les routes acceptent **tout utilisateur connecté** et le contrôle est dans
  l'**en-tête partagé** : visible par tous les rôles, sur toutes les pages.
- Les **objets horaires** synchronisés sont les **sessions de programme**, les
  **rendez-vous de coaching** et les **sessions de venture** (portée personnelle :
  les affectations de la personne et ses sessions coachées, jamais « toutes les
  ventures »). La durée d'une session vient de ses heures de début/fin ; à défaut,
  +1 h. Un rendez-vous de coaching est copié sur +30 min (sa durée n'est pas
  remontée).
- Une nouvelle tâche part vers Google à la synchro suivante (chargement du
  tableau de bord, bouton ou cron), pas instantanément. On pourrait appeler
  `syncUser` après la création d'une tâche, mais cela toucherait au code des
  tâches existant ; ce n'est pas fait dans cette tâche.
- La déconnexion **laisse** l'agenda « Future Studio » dans le compte Google,
  pour ne jamais supprimer de données de l'utilisateur. Une reconnexion
  ultérieure crée un nouvel agenda.
- Le verrou « une synchro à la fois » vaut pour un processus. Sur plusieurs
  instances serverless, deux synchros simultanées restent possibles mais
  rares. Le pire cas est une copie en double d'une tâche dans l'agenda Google
  (l'une des deux n'est plus suivie et doit être supprimée à la main). Un
  verrou en base (`SELECT … FOR UPDATE SKIP LOCKED`) réglerait ce cas si
  besoin.
- L'ancien stub Google Calendar (compte de service, supprimé dans `9c6bb91f`)
  n'est pas réintroduit : cette intégration est séparée du provider Microsoft
  de `src/models/integrations/calendar/`.
