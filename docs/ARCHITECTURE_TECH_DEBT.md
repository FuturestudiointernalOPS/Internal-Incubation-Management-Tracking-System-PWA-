# 🏗️ ImpactOS — Architecture Post-M1 (Plan de Nettoyage)

**Date** : 2026-07-04  
**Source** : Graphify — 355 fichiers, 1021 nœuds, 1442 arêtes, 201 communautés  
**État** : M1 feature-complete. Code fonctionnel, base fragile.  
**Objectif** : Fondations propres avant M2–M5.

> ⚠️ **Chiffres corrigés après audit rigoureux** (comptés, pas estimés). Voir :
> - `docs/SECURITY_AUDIT_M1.md` — audit sécu vérifié (remplace les estimations sécu ci-dessous).
> - `docs/DEEPSEEK_M1_HARDENING_WORKORDER.md` — plan d'exécution code+test séquencé pour DeepSeek (mécanique vs jugement).
>
> Corrections notables : 157 routes (pas ~120), 30 sans auth (pas 20), le bug `$N` internal-comms était un **faux positif**.

---

## 0. PHOTO DU CODEBASE

```
src/
├── app/
│   ├── admin/        (33 fichiers, dont 6 > 1000 lignes)
│   ├── api/          (143 fichiers, ~120 routes)
│   ├── developer/    (7 fichiers)
│   ├── pm/           (5 fichiers, dont 1 monstre de 5001 lignes)
│   ├── staff/        (5 fichiers, dont 1 de 3579 lignes)
│   ├── teacher/      (5 fichiers)
│   └── ...
├── components/
│   ├── dashboard/    (8 fichiers, 4 > 500 lignes)
│   ├── tasks/        (TaskManager.js = 2117 lignes)
│   ├── layout/       (DashboardLayout.js = 1446 lignes)
│   ├── messaging/    (MessagingChat.js = 1340 lignes)
│   └── ...
├── lib/              (19 fichiers — auth, db, i18n, storage...)
├── locales/          (en/ 14 fichiers, fr/ 13 fichiers)
├── migrations/       (30 fichiers SQL éparpillés)
└── hooks/            (2 hooks seulement — useLocale, usePermissions)
```

**Métriques clés :**

| Métrique | Valeur |
|---|---|
| Fichiers totaux | 355 |
| Lignes de code | 81 136 |
| Fichiers > 500 lignes | 33 |
| Fichiers > 2000 lignes | 4 |
| Routes API | **157** (route.js comptés) |
| Routes sans auth | **30** (~13 légitimes public, ~17 brèches) |
| Routes `requireAuth(null)` | 39 |
| Routes `requireAuth([roles])` | **85** |
| Middleware | ❌ Aucun |
| Tests | ❌ 0 |
| Hooks réutilisables | 2 |
| Composants atomiques | 0 |

---

## 1. PROBLÈMES STRUCTURELS (top 5)

### 1.1 Fichiers Dieux — 33 fichiers > 500 lignes

| Rang | Fichier | Lignes | Problème |
|---|---|---|---|
| 1 | `pm/programs/[id]/page.js` | 5001 | 1 page = 1 fichier. Tout : header, tabs, métriques, équipe, calendrier... |
| 2 | `staff/op-report/page.js` | 3579 | Standup + Retro + Summary + Reporting dans 1 composant |
| 3 | `admin/op-reports/page.js` | 2294 | Table + filtres + détails + exports |
| 4 | `TaskManager.js` | 2117 | CRUD tâches + sous-tâches + ressources + commentaires + blockers + drag&drop + assignation |
| 5 | `admin/engineering/permissions/page.js` | 2074 | UI permissions monolithique |

**Impact** : Modifier 1 feature = risque de casser 5 autres. Code review impossible. Merge conflicts garantis.

### 1.2 Pas de couche d'accès aux données

Les requêtes SQL sont écrites **inline** dans les routes API. Zéro réutilisation.

**Exemple concret** : la requête `SELECT * FROM tasks WHERE id = ?` apparaît dans :
- `api/tasks/route.js` (PUT handler)
- `api/tasks/comments/route.js` (pour récupérer le titre)
- `api/tasks/assignments/route.js` (pour le standup sync)
- `api/tasks/approve/route.js`
- `api/blockers/route.js`

5 copies de la même requête. Si la table change → 5 endroits à modifier.

### 1.3 Duplication boilerplate API — 800 lignes

Chaque route répète le même squelette :
```js
export async function GET(req) {
  try { await initDb(); const auth = await requireAuth(); if(auth) return auth;
    const { searchParams } = new URL(req.url); ...
    return NextResponse.json({ success: true, ... });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
```

20 lignes × 120 routes = 2400 lignes. Dont ~800 de duplication pure.

### 1.4 Zéro middleware — pas de filet de sécurité

Sans `middleware.js`, chaque nouvelle route doit **manuellement** appeler `requireAuth()`. Une omission = une brèche. C'est déjà arrivé 20 fois.

### 1.5 Zéro test — pas de filet anti-régression

355 fichiers, 0 test. Chaque changement = risque de casse silencieuse. Détection uniquement via E2E manuel.

---

## 2. SÉCURITÉ — ÉTAT DES LIEUX

Voir `docs/SECURITY_AUDIT_M1.md` pour le détail complet. Résumé :

| Vulnérabilité | Nombre | Sévérité |
|---|---|---|
| Routes mutations sans auth | ~17 | 🔴 Critique |
| Endpoint debug schema-leak | 1 (`debug-db/project-tasks`) | 🔴 Critique |
| Routes auth sans rôle | 39 | 🟠 Élevé |
| Pas de middleware | 1 | 🔴 Critique |
| Upload clé ANON + RLS `anon` write public | 1 | 🟠 Élevé |
| `$N` au lieu de `?` (internal-comms) | **0 — FAUX POSITIF** (voir SECURITY_AUDIT_M1 §1) | — |
| Cron `notify-deadlines` sans secret | 1 | 🟠 Élevé |
| SQL injection | 0 | ✅ |

---

## 3. PLAN D'ACTION — 3 VAGUES

### VAGUE 1 : SÉCURITÉ (8h) 🔴

**Bloquer les brèches avant d'ajouter du code.**

| # | Action | Cible | Effort |
|---|---|---|---|
| S1 | Créer `middleware.js` — protéger `/api/*` par défaut | `src/middleware.js` | 3h |
| S2 | Whitelist des routes publiques (login, reset, forms, invites...) | `src/lib/public-routes.js` | 30min |
| S3 | `requireAuth()` sur les 12 routes critiques exposées | `teams, feedback, errors, v2/*, integrations/*` | 2h |
| S4 | Rôle explicite sur les 39 routes `requireAuth(null)` | Toutes les routes `null` → `['super_admin','staff','developer']` | 2h |
| S5 | Fix `$N` → `?` dans `internal-comms/route.js` | `src/app/api/internal-comms/route.js` L250 | 5min |

### VAGUE 2 : STRUCTURE (24h) 🟠

**Rendre le code navigable et maintenable.**

| # | Action | Effort |
|---|---|---|
| S6 | Créer `src/lib/db/queries/tasks.js` — toutes les requêtes tasks | 3h |
| S7 | Créer `src/lib/db/queries/projects.js` | 2h |
| S8 | Créer `src/lib/db/queries/users.js` (contacts, sessions) | 2h |
| S9 | Wrapper `src/lib/api/createHandler(options)` | 3h |
| S10 | Migrer 20 routes vers `createHandler()` — preuve de concept | 2h |
| S11 | Migrer les 100 routes restantes | 6h |
| S12 | Splitter `TaskManager.js` : `TaskRow` + `TaskForm` + `EditModal` + `ResourceForm` + `useTaskActions` | 6h |

### VAGUE 3 : QUALITÉ (20h) 🟡

**Ajouter les garde-fous.**

| # | Action | Effort |
|---|---|---|
| S13 | `000_base_schema.sql` — dump complet du schéma actuel | 2h |
| S14 | `npm run db:seed` — 10 users test + données minimales | 2h |
| S15 | Tests unitaires `src/lib/db/queries/` (Vitest) | 4h |
| S16 | Tests composants `TaskRow`, `TaskForm` (Testing Library) | 4h |
| S17 | Tests API routes critiques (tasks, projects, auth) | 4h |
| S18 | ESLint + Prettier config | 1h |
| S19 | GitHub Actions : build + lint + test on push | 1h |
| S20 | Upload fichier côté serveur (service role key) | 2h |

---

## 4. ANTI-PATTERNS À ÉRADIQUER

| Pattern actuel | Problème | Solution cible |
|---|---|---|
| `requireAuth()` sans argument | Participant peut delete des projets | `requireAuth(['super_admin','staff'])` |
| SQL inline dans les routes | Copié-collé, impossible à tester | `src/lib/db/queries/*` |
| `try/catch` + `NextResponse.json` répété 120× | 2400 lignes de bruit | `createHandler()` |
| Fichier > 500 lignes | Tout le monde touche → conflits | Max 300 lignes |
| `console.error()` partout | Pas traçable en production | Logger structuré |
| Migration ad-hoc | DB non reproductible | `000_base_schema.sql` + seed |

---

## 5. ARCHITECTURE CIBLE

```
src/
├── app/                    # Pages — routing UNIQUEMENT
│   ├── api/                # Routes API (fines, délèguent à lib/)
│   ├── (auth)/             # Pages login, reset...
│   └── (dashboard)/        # Pages par rôle
├── components/
│   ├── ui/                 # Atomes (Button, Input, Modal, Card, Badge)
│   │   ├── Button.js
│   │   ├── Input.js
│   │   └── Modal.js
│   └── features/           # Composés (TaskRow, ResourceForm...)
│       ├── tasks/
│       │   ├── TaskRow.js
│       │   ├── TaskForm.js
│       │   └── ResourceForm.js
│       └── projects/
├── lib/
│   ├── api/
│   │   └── createHandler.js   # Wrapper route API
│   ├── db/
│   │   ├── db.js              # Pool connection
│   │   └── queries/
│   │       ├── tasks.js
│   │       ├── projects.js
│   │       └── users.js
│   ├── auth.js                # Session + guards
│   ├── i18n.js                # Traductions
│   └── storage.js             # Supabase storage
├── hooks/
│   ├── useTaskActions.js
│   ├── useProjectMembers.js
│   └── useAuth.js
├── middleware.js               # Auth global
├── locales/
└── migrations/
    ├── 000_base_schema.sql
    └── 001_...sql
```

---

## 6. CALENDRIER

| Semaine | Vague | Livrable |
|---|---|---|
| S27 | Vague 1 | middleware.js + routes sécurisées + fix $N |
| S28 | Vague 2 | queries/ + createHandler + TaskManager split |
| S29 | Vague 3 | tests + CI + schema.sql + upload serveur |
| S30 | M2 start | Base propre, prêt pour nouveau code |

---

*Généré depuis graphify (1021 nœuds, 201 communautés) + analyse statique.*
