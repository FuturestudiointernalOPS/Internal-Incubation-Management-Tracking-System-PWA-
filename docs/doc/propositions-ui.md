# Propositions d'amélioration UI — ImpactOS

Date : 2026-09-24 — branche `dashboard_work_frontend`

Principe : améliorer sans casser l'existant. On commence par ce qui a le plus
d'effet pour le moins de risque (les variables de thème), puis on descend page
par page.

---

## 1. Mode clair / sombre (priorité)

### 1.1 À vérifier d'abord
Sur la capture admin, l'icône du thème affiche un **soleil** (= préférence
« Light », voir `src/components/layout/DashboardLayout.js:1581-1587`), mais
l'écran est entièrement sombre.
→ Soit le déploiement Vercel n'est pas à jour, soit le mode clair ne s'applique
pas sur cette page. **À reproduire en local.**

### 1.2 Cause principale : des couleurs écrites en dur
Les variables de thème existent et sont correctes (`src/app/globals.css:12-65`),
mais beaucoup d'écrans les contournent :

| Motif en dur | Occurrences | Fichiers |
|---|---|---|
| `text-white` | 459 | 88 |
| `bg-black…` | 150 | 61 |
| `bg-[#0f172a]`, `bg-[#020617]`, … | 144 | 16 |

Conséquence : en mode clair ces éléments restent sombres, ou donnent du texte
blanc sur fond blanc.

Fichiers les plus touchés (`bg-[#…]`) :
- `src/app/admin/system/page.js`
- `src/app/admin/integrations/page.js`
- `src/app/admin/security/page.js`
- `src/app/admin/communications/segments/page.js`

Correction : remplacer par les variables (`bg-surface-1`, `var(--text-primary)`,
etc.) conformément à `DESIGN_SYSTEM.md`. Garder `bg-black/40`, `bg-black/80`
pour les voiles de modale (overlay) : ceux-là sont voulus.

### 1.3 Mode sombre : les couches se confondent
- Fond `--bg-primary: #020617` et cartes `--surface-1: #0f172a` sont presque
  identiques ; les bordures `--border-primary: #334155` sont peu visibles.
- Résultat : on distingue mal les cartes, tout paraît « pareil ».

Proposition (uniquement dans `globals.css`, donc effet global et sans risque de
casser la structure) :
- éclaircir légèrement `--surface-1` / `--surface-2` en sombre ;
- renforcer un peu les bordures ;
- en mode clair, ajouter une ombre légère aux cartes pour mieux les détacher du
  fond `#f8fafc`.

---

## 2. Calendrier (admin + staff) — le plus visible

Constats :
- « Terminer toutes les tâches » répété dans chaque case, tronqué → bruit visuel.
- Texte barré vert/bleu (tâches terminées) quasi illisible.
- Jours passés non différenciés ; « aujourd'hui » peu mis en avant sur l'admin.
- Légende incohérente : **statut** sur l'admin (en attente, actif, bloqué,
  terminé, reporté) vs **type** sur le staff (task, program, session,
  deliverable, event).

Propositions :
- regrouper les tâches récurrentes / identiques + badge « +N » au-delà de 2 ;
- tâches terminées estompées plutôt que barrées en couleur ;
- jours passés grisés, jour courant bien marqué ;
- une seule logique de légende pour les deux écrans.

Fichiers : `src/components/dashboard/UnifiedDashboard.js` (staff),
`src/app/admin/page.js` (admin), `src/components/ui/CalendarPanel.js`.

---

## 3. Cartes KPI

- Valeurs « — » sans signification (« Projets » sur l'admin, « Programmes
  actifs » et « Ce mois-ci » sur le CRM alors que l'admin affiche 1 programme).
  → afficher `0` ou un vrai état vide / chargement.
- Carte « Projets » avec bordure orange sans raison, seule sur sa ligne
  (grille 3 + 1). → grille régulière, bordure d'accent réservée à un état.

---

## 4. Typographie et lisibilité

- Quasi tout est en MAJUSCULES espacées → plus de hiérarchie visible.
  → majuscules seulement pour les petits labels de section ; titres et contenus
  en casse normale.
- Libellés coupés dans la sidebar (« APPROBATIONS EN ATTE… »).
  → casse normale + éventuellement libellé plus court ou retour à la ligne.

---

## 5. Traduction et formats (règle du projet — voir AGENTS.md §1)

- Rôles non traduits en FR : « MEMBER » dans le CRM (contacts récents).
- Dates au format US en FR : « 8/18/2026 » (programmes actifs), « 9/16/2026 »
  (activité récente). → passer par `formatDate` selon la langue.
- Toute nouvelle chaîne : `t()` + clé dans `src/locales/en/` **et**
  `src/locales/fr/`, puis `npm run i18n:parity` (Missing doit rester à 0).

---

## 6. Mise en page

- Largeur de contenu différente selon les pages (CRM plus étroit que l'admin).
  → une largeur max commune.
- Grands blocs vides (« Rapports récents — Aucun résultat trouvé »).
  → utiliser `AppEmptyState`, plus compact.
- Deux boutons flottants sur le bord droit qui chevauchent le contenu.
- « Retour au menu précédent » sur le CRM, redondant avec la sidebar.

---

## Plan d'action (du moins risqué au plus visible)

1. **Audit mode clair en local** : `npm install`, `npm run dev`, passer les
   pages principales en Light et lister les soucis ou les choses qui ont besoin de changement (captures).
2. **Ajuster les variables de thème** (`globals.css`) : contraste cartes /
   bordures dans les deux modes.
3. **Remplacer les couleurs en dur** page par page — commencer par les
   dashboards admin, staff et CRM.
4. **Refonte du calendrier** : regroupement, lisibilité, légende unifiée.
5. **Petites corrections** : KPI « — », traductions manquantes, format des
   dates, largeur des pages.

Avant chaque push : `npm run lint` (0 erreur), `npm run build`,
`npm run i18n:parity`, et vérifier l'écran en **clair et en sombre**.

---

## Suivi — ce qui a été fait (2026-09-24, non commité)

Vérifs : `npm run lint` 0 erreur (4 warnings déjà présents dans `useApi.js`),
`npm test` 186/186 suites OK, `npm run i18n:parity` Missing 0, `npm run build` OK.

### Découverte importante
632 classes du type `bg-[var(--brand-orange)]/10`, `border-[var(--border-primary)]/50`
(133 fichiers) ne généraient **aucun CSS** : Tailwind 3 ne sait pas appliquer une
opacité à une variable. Tous les fonds teintés orange, bordures d'accent, anneaux de
focus et le surlignage du jour du calendrier étaient donc invisibles → c'est une
grosse partie de l'aspect « plat ».
→ Ajout des couleurs `brand-orange` et `divider` dans `tailwind.config.js` et
remplacement automatique (`bg-brand-orange/10`, `border-divider/50`). Règle notée
dans `DESIGN_SYSTEM.md`.

### 1. Thème
- `globals.css` : sombre = fond `#060a14` / cartes `#111a2c` (vraie séparation),
  clair = fond `#f3f5f8` + ombre douce sur `.card`.
- Mode clair : les textes de statut `text-*-400/500` (≈2 350 usages) sont
  assombris automatiquement (700) → lisibles sur blanc. Le sombre ne change pas.
- Couleurs en dur remplacées par les variables : `admin/system`,
  `admin/integrations`, `admin/security`, `admin/audit-logs`,
  `admin/communications/segments` (+ classes cassées `[#FF6600]/80/10` réparées).
- 1.1 (icône soleil mais écran sombre) : **à vérifier en local**, pas reproduit
  dans le code.

### 2. Calendrier (admin + staff)
- Tâche sur plusieurs jours : titre au 1er jour, au dernier et au début de chaque
  semaine ; les jours intermédiaires = fine barre colorée (titre au survol).
- Tâches terminées : grises et barrées (plus de vert illisible) ; le statut passe
  avant la priorité.
- Jour courant : pastille orange + cadre ; jours passés estompés.
- Tâches de même titre le même jour (ex. la copie « reportée » + l'originale
  terminée) affichées une seule fois, sans compteur, avec le statut le plus
  urgent (ouverte avant terminée). Idem dans « À venir » (admin).
- « +N more » / « Show less » traduits.
- Légende : laissée par statut (admin, tâches seules) / par type (staff, plusieurs
  sources) — mêmes codes visuels pour terminé / bloqué.

### 3. KPI
- Admin « Projets » affichait toujours « — » : l'API ne renvoyait pas le chiffre.
  Ajout de `countActiveProjects()` (`src/models/adminOps.js`) + champ `projects`
  dans `/api/superadmin/full-state`.
- Grille admin régulière (4 colonnes). La bordure orange sur « Projets » était
  juste le survol.
- CRM : « Programmes actifs » et « Ce mois-ci » calculés (plus de « — » en dur),
  squelette pendant le chargement, cartes visibles (`card` au lieu de `bg-primary`
  sur fond `bg-primary`).

### 4. Typographie
- Sidebar en casse normale, 13 px (plus de libellés coupés en majuscules).
- Titres des dashboards admin / staff / CRM en casse normale.

### 5. Traduction / formats
- Rôle `member` traduit (Membre). Dates selon la langue (`toLocaleDateString(lang)`)
  dans les dashboards admin/staff et le calendrier.
- Chaînes en dur traduites : « Dashboard », « Retry », « Loading » (staff).

### 6. Mise en page
- CRM : même largeur que l'admin ; « Contacts récents » vraiment triés par date,
  avec avatar, nom + email, badge de rôle.
- « Rapports récents » vide → `AppEmptyState` (et correction de la taille de son
  icône, qui ne s'affichait pas).
- Les 2 boutons flottants à droite ne viennent **pas** de l'app (extension du
  navigateur).
- « Retour au menu précédent » conservé (motif commun à toutes les pages CRM).

### À tester avant commit
Clair **et** sombre, FR **et** EN : `/admin`, `/admin/crm`, `/staff`,
`/admin/system`, `/admin/security`, `/admin/integrations`, `/admin/audit-logs`,
`/admin/communications/segments`, la sidebar (repliée / dépliée).
