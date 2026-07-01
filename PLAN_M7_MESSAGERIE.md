# PLAN — Module 7 : Messagerie Interne (Sprint 01)

> Généré le 01/07/2026 · Source : investigations graphify + grep · Réf : `PRODUCT.md` §8 Sprint 01 M7

---

## 0. Constat initial : M7 est déjà largement implémenté

L'investigation révèle que la messagerie ImpactOS **existe déjà et fonctionne** pour 5 rôles :

| Rôle | Page | Composant |
|---|---|---|
| Super Admin | `/admin/internal-comms` | `MessagingChat({role:"super_admin"})` |
| Staff | `/staff/messages` | `MessagingChat({role:"staff"})` |
| Program Manager | `/pm/messages` | `MessagingChat({role:"program_manager"})` |
| Teacher | `/teacher/messages` | `MessagingChat({role:"teacher"})` |
| Participant | `/participant/messages` | `MessagingChat({role:"participant"})` |

**Ce qui fonctionne déjà :**
- DM 1-to-1 → réglé (permission `canMessage()` filtrée par rôle/groupe/programme)
- Chat de groupe (familles) → réglé (`target_type="role"`)
- Chat de programme → réglé (`target_type="program"`)
- Broadcast (tous les utilisateurs) → réglé (`target_type="all"`, SA uniquement)
- Notifications → réglé (créées automatiquement dans `v2_notifications`, affichées dans DashboardLayout)
- Polling 10s → réglé (`setInterval` dans MessagingChat)
- Mobile responsive → réglé (list ↔ chat toggle)
- Dark mode → réglé
- i18n (fr/en) → réglé

**Conclusion :** Pas de refonte M7 complète. Appliquer le workflow Sprint 01 → **comprendre → tester → identifier bugs/gaps → corriger/compléter**.

---

## 1. Phase Compréhension — Architecture existante

### Tables
```
v2_messages (id, sender_id, recipient_id, target_type, target_id, subject, body, priority, is_read, created_at)
v2_notifications (id, recipient_id, title, message, type, is_read, created_at)
contacts (cid, name, email, role, group_name, status, ...)
```
- Pas de FK, tout est TEXT → intégrité référentielle via scripts de cleanup
- Pas de table `conversations` → threads calculés client-side
- `campaigns` / `campaign_steps` / `campaign_contacts` → système email séparé (hors scope M7)

### Routes API
| Méthode | Route | Usage |
|---|---|---|
| GET | `/api/internal-comms?cid=` | Récupère messages de l'utilisateur |
| POST | `/api/internal-comms` | Envoie message (individual/role/program/all) |
| PUT | `/api/internal-comms` | Marque messages lus |
| POST | `/api/messages` | Legacy — POST simple avec program_id |
| GET/POST/PATCH | `/api/notifications` | CRUD notifications |

### Composant principal
```
src/components/messaging/MessagingChat.js  (~1300 lignes)
  └── Conversation list (gauche)
  └── Chat panel (droite)
  └── Compose modal (4 modes)
  └── Polling 10s
```

### Permissions
- Frontend : `getPermissions()` → `canMessage(contact)`, `sendModes`
- Serveur : `requireAuth()`, CID-scoping, sender validation, conversation ownership
- RBAC : modules `messaging` + `internal_comms`, capabilities `view`/`send`/`delete`

---

## 2. Phase Tests Fonctionnels — Checklist par gap identifié

### ⚠️ GAP 1 : Broadcast non protégé côté serveur [SÉCURITÉ]
```
src/app/api/internal-comms/route.js:68 → POST
```
- `requireAuth(["staff","super_admin","program_manager","teacher"])` autorise staff/PM/teacher
- **Aucun check** côté serveur que `target_type="all"` est réservé à SA
- Frontend seul (`MessagingChat.js:51-52`) bloque l'UI pour non-SA
- **Risque :** requête curl/POST directe par un staff avec `target_type:"all"` → broadcast non autorisé

### ⚠️ GAP 2 : Contacts/full-state sans auth
```
src/app/api/contacts/full-state/route.js:9 → GET sans auth
```
- Expose emails + noms du registre complet
- Impact messagerie : la liste des contacts pour DM fuit côté API

### GAP 3 : Pas de suppression/archive de messages
```
Permission "delete" définie dans auth.js → jamais implémentée en UI
```
- Aucune route DELETE dans `/api/internal-comms`
- Aucune UI pour supprimer un message/conversation

### GAP 4 : Polling 10s → pas de real-time
```
Package ws installé (v8.21.0) mais inutilisé
```
- Pas de WebSocket / Supabase Realtime
- 10s de latence pour nouveaux messages

### GAP 5 : Pas de pièces jointes / médias
```
Texte uniquement — subject + body
```
- Pas de upload, pas de champ `attachment_url` dans `v2_messages`

### GAP 6 : Pas de recherche full-text
```
Recherche conversations uniquement (filtre nom côté client)
```
- Pas de recherche dans le contenu des messages

### GAP 7 : `/api/messages` (legacy) moins sécurisé que `/api/internal-comms`
```
src/app/api/messages/route.js → aucun getSession(), aucun check sender_id/recipient_id
```
- `requireAuth([...])` vérifie juste rôle autorisé, ne renvoie jamais la session → sender_id du body jamais comparé à l'utilisateur réel → **usurpation d'identité possible** (n'importe quel staff/PM/teacher peut envoyer "en tant que" un autre CID)
- Branche broadcast : `recipient_id === "all"` (PAS `target_type`, ce champ n'existe pas dans ce endpoint) → notifie tous les participants du programme, sans restriction de rôle → n'importe quel staff/PM/teacher peut déclencher un broadcast programme
- Route utilisée par la page developer uniquement → vérifier si toujours nécessaire

### GAP 8 : `/developer/messages` appelle une méthode GET inexistante [BUG FONCTIONNEL confirmé]
```
src/app/developer/messages/page.js:29 → fetch(`/api/messages?user_id=...`)  [GET]
src/app/api/messages/route.js → exporte SEULEMENT POST, aucun GET
```
- Next.js renvoie 405 sur ce fetch → `data.success` toujours falsy → page affiche "No messages" en permanence, sans erreur visible
- Page développeur cassée depuis le début (ou route jamais adaptée après ajout du POST-only)

---

## 3. Phase Analyse — Plan d'action priorisé

### 🔴 Priorité Critique — Sécurité

| N° | Action | Fichier | Effort |
|---|---|---|---|
| **A1** | Bloquer `target_type="all"` pour non-SA côté serveur | `src/app/api/internal-comms/route.js` | 5 lignes |
| **A2** | Bloquer `recipient_id="all"` pour non-SA + valider `sender_id === session.cid` dans `/api/messages/route.js` (corrigé : ce champ est `recipient_id`, pas `target_type` — le champ `target_type` n'existe pas dans ce endpoint legacy) | `src/app/api/messages/route.js` | 10 lignes |
| **A3** | Ajouter auth sur `/api/contacts/full-state` | `src/app/api/contacts/full-state/route.js` | 10 lignes |
| **A4** | Ajouter `getSession()` + comparer `sender_id` à l'utilisateur authentifié dans `/api/messages/route.js` (actuellement `requireAuth` valide seulement le rôle, jamais l'identité → usurpation possible) | `src/app/api/messages/route.js` | 5 lignes |

### 🟡 Priorité Haute — Fonctionnalités manquantes

| N° | Action | Fichier | Effort |
|---|---|---|---|
| **B1** | Ajouter DELETE `/api/internal-comms` (soft-delete : `is_deleted=1`) | `src/app/api/internal-comms/route.js` + schema | 30 lignes |
| **B2** | Ajouter colonne `is_deleted INTEGER DEFAULT 0` à `v2_messages` | `supabase/v2_schema_init.sql` + migration | 1 migration |
| **B3** | UI : bouton supprimer message (sender uniquement) | `MessagingChat.js` | 40 lignes |
| **B4** | Corriger `/developer/messages` : ajouter `GET` à `/api/messages/route.js` OU rediriger le fetch vers `/api/internal-comms?cid=` (réutilise l'existant, cohérent avec le reste M7) | `src/app/developer/messages/page.js` ou `src/app/api/messages/route.js` | 20 min |

### 🔵 Priorité Moyenne — Améliorations

| N° | Action | Effort estimé |
|---|---|---|
| **C1** | Websocket/Realtime → remplacer polling 10s | Jour/homme (nouvelle infra) |
| **C2** | Pièces jointes (upload fichier + lien dans message) | 0.5 jour/homme |
| **C3** | Recherche full-text messages (PostgreSQL `tsvector`) | 0.5 jour/homme |
| **C4** | Supprimer `/api/messages` si plus utilisé (ou l'aligner sur `internal-comms`) | 1h |

### 🔵 Nice-to-have

| N° | Action |
|---|---|
| **D1** | Typing indicators |
| **D2** | Statut "en ligne" des contacts |
| **D3** | Limiter historique messages (pagination) |

---

## 4. Phase Implémentation — Ordre d'exécution

### Étape 1 : Fix sécurité (A1 → A2 → A3 → A4) ~40 min
1. `internal-comms/route.js` : ajouter `if (target_type === 'all' && role !== 'super_admin') return 403`
2. `messages/route.js` : ajouter `getSession()`, bloquer `recipient_id === 'all'` pour non-SA, vérifier `sender_id === session.cid`
3. `contacts/full-state/route.js` : ajouter `requireAuth(["staff","super_admin"])`

### Étape 2 : Delete message (B1 → B2 → B3) ~1h
1. Migration SQL : `ALTER TABLE v2_messages ADD COLUMN is_deleted INTEGER DEFAULT 0`
2. Route DELETE : soft-delete, vérifier `sender_id === session.cid` (sauf SA)
3. UI : icône poubelle au hover du message, confirmation dialog

### Étape 3 : Fix bug + Nettoyage (B4 → C4) ~50 min
1. `/developer/messages/page.js` fetch un GET sur une route qui n'exporte que POST → 405 silencieux, page toujours vide. Remplacer par `GET /api/internal-comms?cid=` (réutilise l'existant)
2. Une fois `/developer/messages` migré → vérifier si `POST /api/messages` a d'autres appelants
3. Si non → décommissionner la route legacy `/api/messages`

### Étape 4+ : Améliorations (C1-C3, D1-D3)
→ Planning séparé, hors scope Sprint 01

---

## 5. Phase Validation — Checklist post-implémentation

- [ ] Broadcast (internal-comms) : curl POST `target_type:"all"` avec token staff → 403
- [ ] Broadcast (internal-comms) : curl POST `target_type:"all"` avec token SA → 200
- [ ] Broadcast (messages legacy) : curl POST `recipient_id:"all"` avec token staff → 403
- [ ] Usurpation (messages legacy) : curl POST avec `sender_id` ≠ CID du token → 403
- [ ] Delete : sender peut supprimer son propre message
- [ ] Delete : non-sender ne peut pas supprimer le message d'un autre
- [ ] Delete : message supprimé n'apparaît plus dans la conversation
- [ ] Contacts/full-state → 401 sans cookie session
- [ ] `/developer/messages` : messages s'affichent bien (plus de 405 silencieux)
- [ ] DM : pas de régression (sender→recipient ok)
- [ ] Groupe : pas de régression (target_type="role" ok)
- [ ] Programme : pas de régression (target_type="program" ok)
- [ ] Broadcast SA : pas de régression
- [ ] Notifications : toujours créées après envoi message
- [ ] Polling 10s : toujours fonctionnel
- [ ] Mobile responsive : pas de régression
- [ ] Dark mode : pas de régression

---

## 6. Phase Soumission — Critères d'acceptation M7

- ✅ Tous les bugs sécurité (A1-A4) corrigés
- ✅ Delete message implémenté (B1-B3)
- ✅ Bug `/developer/messages` corrigé (B4)
- ✅ Route legacy nettoyée (C4)
- ✅ Pas de régression sur l'existant
- ✅ UI préservée (pas de changement cosmétique non justifié)
- ✅ Composants/APIs/ressources globales réutilisés
- ✅ Tests E2E passés

---

## Résumé des fichiers touchés (ordre)

| Priorité | Fichier | Action |
|---|---|---|
| 🔴 | `src/app/api/internal-comms/route.js` | Ajout guard broadcast + endpoint DELETE |
| 🔴 | `src/app/api/messages/route.js` | Ajout `getSession()`, guard `recipient_id="all"`, check `sender_id` |
| 🔴 | `src/app/api/contacts/full-state/route.js` | Ajout auth |
| 🟡 | `supabase/v2_schema_init.sql` | Colonne `is_deleted` |
| 🟡 | `src/migrations/` | Migration `is_deleted` |
| 🟡 | `src/components/messaging/MessagingChat.js` | UI delete + ajustements |
| 🟡 | `src/app/developer/messages/page.js` | Fix GET 405 → basculer sur `/api/internal-comms?cid=` |
| 🔵 | (suite étape 3) | Décommissionner `/api/messages` si plus d'appelant |

**Effort total estimé :** ~2h50 (étapes 1-3, incluant fix B4)
**Améliorations (étape 4+) :** 2-3 jours/homme → planning séparé

---

## Note de vérification (01/07/2026)

Plan re-vérifié ligne à ligne contre code réel (graphify rebuild src/ + grep/Read direct, pas juste le graphe — graphe ne capture pas assez de détail ligne par ligne pour ce niveau de vérif sécurité).

Confirmé exact : GAP1, GAP2, GAP3, GAP4, GAP5, GAP6, schéma (`v2_messages`/`v2_notifications`, pas de `conversations`, pas de `is_deleted`), 5 pages rôles + `MessagingChat.js` (1305 lignes réelles vs ~1300 estimé), `ws` installé inutilisé.

Corrigé : GAP7/A2 citait `target_type="all"` pour `/api/messages/route.js` — faux, ce champ n'existe pas dans cet endpoint (seulement dans `internal-comms`). Le vrai champ est `recipient_id`. En plus, `messages/route.js` n'appelle jamais `getSession()` — `requireAuth()` valide le rôle mais jamais l'identité → `sender_id` du body totalement non vérifié (usurpation possible), pire que ce que disait le plan initial.

Ajouté : GAP8 — `/developer/messages/page.js:29` fetch un `GET /api/messages` qui n'existe pas (route n'exporte que `POST`) → 405 silencieux, page toujours vide. Bug réel non détecté par l'investigation initiale. Ajouté comme B4.
