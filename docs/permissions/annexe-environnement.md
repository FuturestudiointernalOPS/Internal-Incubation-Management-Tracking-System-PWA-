# Annexe — Méthodes de vérification dépendant de l'environnement

> Document de **procédures**. Rien n'a été exécuté pour le produire : aucune
> requête réseau, aucune requête base, aucun script lancé. Les commandes et
> requêtes ci-dessous sont à exécuter **plus tard, sur autorisation explicite**.
>
> Chaque méthode précise : objectif, prérequis, commande(s)/requête(s) exactes,
> risques, ce que le résultat **prouverait**, ce qu'il **ne prouverait pas**.

## Conventions de statut

| Marque | Signification |
|---|---|
| ✅ **EXISTE** | Le mécanisme/script/fichier est présent dans le dépôt (référence `fichier:ligne` vérifiée). |
| 🟡 **PARTIEL** | Des éléments existent mais ne couvrent pas la vérification demandée telle quelle. |
| ❌ **PROPOSÉ / À CRÉER** | Rien n'existe dans le dépôt ; la méthode décrite est une proposition. |

Les trois identités de base sont définies une seule fois, dans le code :
`src/lib/identity.js:24` — `BASELINE_IDENTITIES = ["super_admin", "staff", "member"]`.

---

## Méthode 1 — Inventaire des identités héritées

**Statut : ✅ EXISTE (mécanisme de sondage), avec une variante « sans données personnelles » à privilégier.**

### Objectif

Lister les valeurs **réellement présentes** dans `contacts.role`, groupées avec
comptage, et les comparer aux 3 identités de base
(`super_admin`, `staff`, `member`). La colonne ne devrait contenir que ces trois
valeurs ; toute autre valeur est une identité **héritée/contextuelle** qui doit
être réconciliée.

### Ce qui existe déjà dans le dépôt

| Élément | Emplacement | Nature |
|---|---|---|
| Requête de sondage (agrégée) | `src/models/authorization/legacyRoleCleanupStore.js:28-35` (`listContactRoleCounts`) | `SELECT role, COUNT(*)::int AS count FROM contacts GROUP BY role ORDER BY count DESC, role` |
| Sondage applicatif complet | `src/services/authorization/legacyRoleCleanup.js:145-164` (`surveyLegacyRoles`) | Agrège **et** liste les comptes (cid/name/status) — **expose des données personnelles** |
| Endpoint de sondage | `src/app/api/engineering/permissions/legacy-role-cleanup/route.js:34-52` (GET) | Réservé à `permissions.view_matrix`, même-origine |
| Script d'alignement (dry-run par défaut) | `scripts/align-legacy-roles.mjs:86-91` | Contient la même requête agrégée ; `--apply` réécrit la colonne (ne pas utiliser ici) |
| Script de diagnostic staging (lecture seule) | `scripts/diagnose-staging-authz.mjs:48` | `SELECT role, count(*) AS n FROM contacts GROUP BY role ORDER BY n DESC` |
| Script de backfill I6D (lecture + écriture) | `scripts/i6d-legacy-backfill.mjs:47-51` | Sélectionne les candidats ; `APPLY` réécrit (ne pas utiliser ici) |
| Tests du nettoyage | `src/__tests__/legacy-role-cleanup-phase-h.test.js` | Couvre GET/POST et `logPermissionAudit` |

**Précisions de nommage (vérifiées) :**

- Il n'existe **pas** de fichier `scripts/legacy-role-cleanup.mjs`. Le nom
  `legacy-role-cleanup` désigne l'**endpoint API**
  (`src/app/api/engineering/permissions/legacy-role-cleanup/route.js`) et son
  test, pas un script.
- `scripts/scan-role-gates.mjs` existe mais **ne sonde pas la base** : c'est une
  analyse statique des motifs de garde dans `src/app/api/` (aucun accès base).
  À ne pas confondre avec un sondage de valeurs de rôle.
- `scripts/simulate-roles.mjs` et `scripts/test-roles.mjs` existent : ce sont des
  tests de **résolution** de rôle, rien n'est écrit en base.

### Prérequis

1. **Copie hors production obligatoire.** Exécuter sur un clone/restauration
   (`pg_dump` → base de travail, ou l'environnement staging utilisé comme copie),
   jamais contre la production directement. Le fichier `.env.local` de ce poste
   pointe vers **staging** (voir `AGENTS.md`) : vérifier l'hôte avant toute
   connexion.
2. Un accès base **en lecture seule** (rôle `SELECT` uniquement) est suffisant.
3. Définir `DATABASE_URL` vers la **copie** (le sondage applicatif et les scripts
   lisent `DATABASE_URL` / `.env.local` / `.env.staging` / `.env.audit-staging`).

### Requête exacte (lecture seule, agrégée, sans donnée personnelle)

```sql
-- Sondage : le nombre de comptes par valeur de rôle, et si la valeur est une
-- identité de base. Aucune colonne nominative (pas de cid/name/email).
SELECT role,
       COUNT(*)::int                                   AS count,
       (role IN ('super_admin', 'staff', 'member'))    AS is_baseline
  FROM contacts
 GROUP BY role
 ORDER BY is_baseline DESC, count DESC, role;
```

Contrôle de conformité (doit renvoyer 0 ligne si aucune identité héritée ne
subsiste) :

```sql
SELECT role, COUNT(*)::int AS count
  FROM contacts
 WHERE role IS DISTINCT FROM 'super_admin'
   AND role IS DISTINCT FROM 'staff'
   AND role IS DISTINCT FROM 'member'
 GROUP BY role
 ORDER BY count DESC;
```

### Ce que la requête agrégée NE fait PAS

- Elle **n'expose aucune donnée personnelle** : pas de nom, pas d'email, pas de
  `cid` — uniquement des valeurs de rôle et des comptages.
- **Ne pas** utiliser pour ce point l'endpoint GET ni `surveyLegacyRoles` « en
  entier » : `listContactsByRole` (`legacyRoleCleanupStore.js:38-47`) joint
  `cid, name, status` et **exposerait** des données personnelles. Si le besoin
  nominatif existe un jour, il faudra une base d'autorisation distincte.

### Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| Exécution accidentelle contre la **production** | Élevée | Copie obligatoire ; vérifier l'hôte de `DATABASE_URL` avant connexion |
| Charge/lock sur une base chaude | Faible (agrégat `GROUP BY` sur table indexée) | Base de copie |
| Confusion avec l'endpoint qui expose des noms | Moyenne | Utiliser **la requête agrégée ci-dessus**, pas l'endpoint |
| Lancer `align-legacy-roles.mjs` / `i6d-legacy-backfill.mjs` sans dry-run | Élevée (écriture) | Ne pas lancer ces scripts ici ; le dry-run reste une connexion base |

### Ce que le résultat prouverait

- La **distribution réelle** des valeurs de `contacts.role` sur la copie.
- L'**absence ou la présence** d'identités héritées, et leur volume exact.
- Le **gate `safe`** (aucun compte sur une valeur héritée) équivalent au rapport
  `buildLegacyRoleReport` (`legacyRoleCleanup.js:111-136`, champ `safe`).

### Ce qu'il ne prouverait PAS

- Que les comptes porteurs d'un rôle hérité **devraient** être reclassés
  (`member` ou `staff`) : c'est une décision appliquée plus tard par
  `align-legacy-roles.mjs --apply` / le POST de l'endpoint, pas le sondage.
- Que les **rangées de contexte** (`contact_roles`, `participant_programs`,
  `venture_members`…) ou les **cartes de profil** couvrent correctement ces
  comptes.
- Que les **sessions** se comportent correctement après reclassement.
- Rien sur la **production** si la requête tourne sur une copie/staging : les
  valeurs peuvent différer de la production.

---

## Méthode 2 — `npm audit`

**Statut : ✅ EXISTE (commande standard npm) ; référence registre : DEP-1.**

### Objectif

Obtenir la liste des avis de vulnérabilité connus pour l'arbre de dépendances
**verrouillé** (`package-lock.json`), sans rien installer ni corriger.

### Prérequis

1. Accès **réseau** vers le registre npm (métadonnées d'avis).
2. `package-lock.json` présent et synchronisé avec `package.json`.
3. Node/npm installés (le projet déclare `"node": ">=22.0.0"` dans
   `package.json`).

### Commande exacte (aucune modification de fichier)

```bash
# Rapport lisible, sans installation ni correction automatique.
npm audit --json

# Variante : ne considérer que les dépendances de production.
npm audit --omit=dev --json
```

**Interdits pour cette vérification :** `npm audit --fix`, `npm audit --force`,
`npm install`, `npm update`. `npm audit` (sans `--fix`) **n'écrit aucun fichier**.

### Comment interpréter (référence DEP-1)

Le registre `docs/SECURITY_AUDIT_REGISTER.md` documente la vulnérabilité
attendue :

- Baseline d'audit : « `npm audit` — 4 vulnérabilités (1 critique, 3 hautes) —
  toutes `tar` via `unpdf → canvas` » — `docs/SECURITY_AUDIT_REGISTER.md:23`.
- Fiche DEP-1 : « CRITICAL/HIGH `tar` via `unpdf → canvas` ; pas de correctif en
  amont » — `docs/SECURITY_AUDIT_REGISTER.md:254-256`.
- Risque résiduel accepté : « `tar` n'a pas de correctif en amont ; atteignable
  seulement via le build natif de `canvas`, pas via le chemin de lecture PDF » —
  `docs/SECURITY_AUDIT_REGISTER.md:344` (voir aussi `:381` et `:471`).

Lecture attendue : si l'arbre n'a pas changé, on doit retrouver le même motif
(`tar` via `unpdf → canvas`), **sans correctif disponible**. Toute **nouvelle**
entrée (autre paquet, sévérité critique) doit être traitée comme un écart par
rapport au registre.

### Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| Modification de fichiers | **Aucune** — `npm audit` sans `--fix` n'écrit rien | Ne pas ajouter `--fix`/`--force` |
| Fuite d'information vers le registre | Faible — seules les métadonnées de dépendances sont envoyées | Acceptable ; en cas de contrainte réseau, utiliser un miroir interne |
| Échec si le lockfile est absent/désynchronisé | Faible | Vérifier la présence de `package-lock.json` avant |
| Faux sentiment de sécurité | Moyenne | Voir « ce qu'il ne prouve pas » |

### Ce que le résultat prouverait

- Que les avis **connus** du registre ne concernent que `tar` (via
  `unpdf → canvas`), conformément à DEP-1 — ou signalent tout écart nouveau.
- L'état de l'arbre **verrouillé** au moment de l'exécution.

### Ce qu'il ne prouverait PAS

- L'**exploitabilité réelle** : atteignable seulement via le build natif de
  `canvas`, pas le chemin de lecture PDF (registre :344).
- Qu'aucune vulnérabilité **non publiée** ou non couverte par un avis n'existe.
- Que l'absence de `--omit=dev`/présence de devDependencies n'ait pas d'impact :
  les deux variantes couvrent des périmètres différents.

---

## Méthode 3 — Comparaison schéma réel vs migrations

**Statut : 🟡 PARTIEL — le document d'audit et des scripts de lecture de
`information_schema` existent ; la procédure de comparaison complète reste à
dérouler.**

### Objectif

Confronter le **schéma réel** de la base (tables/colonnes/types) à ce que
**décrivent les migrations** sur disque, et repérer les divergences (colonne
attendue absente, type incompatible, table manquante).

### Ce qui existe déjà dans le dépôt

| Élément | Emplacement | Nature |
|---|---|---|
| Audit de dérive schéma | `docs/SCHEMA_DRIFT_AUDIT.md` | 162 requêtes statiques cassées sur 741, par clusters |
| Migrations (dossier 1) | `migrations/*.sql` (39 fichiers) | Migrations nommées par phase/domaine |
| Migrations (dossier 2) | `supabase/migrations/*.sql` (13 fichiers) | Migrations horodatées (LMS, finance, plateforme) |
| Lecture `information_schema.columns` | `scripts/audit-program-progress.mjs:199-202` | Exemple : colonnes de `v2_programs` |
| Lecture `information_schema.tables/columns` | `scripts/diagnose-prod-foundation.mjs:48-60` | Inventaire foundation + colonnes |
| Audit contexte (agrégats par rôle/contexte) | `scripts/audit-context-data.mjs` | Lecture seule |

**Attention (deux dossiers de migrations).** `migrations/` (nommage par phase)
et `supabase/migrations/` (nommage horodaté) coexistent. Toute comparaison doit
**lister les deux**.

**Attention (maintenance runtime).** `AGENTS.md` et `src/lib/db.js` signalent que
l'application applique elle-même du `CREATE TABLE IF NOT EXISTS` /
`ADD COLUMN IF NOT EXISTS` au premier usage (sauf
`SKIP_RUNTIME_SCHEMA_MAINTENANCE`). Le schéma **live** peut donc être **en avance**
sur les fichiers de migration — une divergence « live ≠ migrations » n'implique
pas forcément un bug.

### Méthode

1. **Lister les migrations** (inventaire sur disque, aucune base) :

   ```bash
   ls -1 migrations/*.sql
   ls -1 supabase/migrations/*.sql
   ```

2. **Interroger le schéma réel** (lecture seule, base de copie).

3. **Comparer** : pour chaque table/colonne référencée par le code ou attendue par
   une migration, vérifier sa présence/type via le gabarit ci-dessous.

### Gabarit de requête (lecture seule)

```sql
-- Tables du schéma applicatif.
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
 ORDER BY table_schema, table_name;

-- Colonnes d'une table précise (adapter le nom).
SELECT table_name, column_name, data_type, udt_name,
       is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'contacts'          -- remplacer par la table à vérifier
 ORDER BY ordinal_position;

-- Vue croisée : toutes les colonnes du schéma public d'un coup.
SELECT table_name, column_name, data_type, udt_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
 ORDER BY table_name, ordinal_position;
```

### Prérequis

1. Base de **copie** (pas la production) et accès **lecture seule**.
2. Connaître la liste des tables/colonnes attendues par le code (voir
   `docs/SCHEMA_DRIFT_AUDIT.md` pour les clusters déjà identifiés).
3. Si l'on veut rejouer la méthode de l'audit existant (validation par
   `PREPARE`), la documentation mentionne cette technique : elle **parse et
   planifie sans exécuter** — mais reste à lancer prudemment, sur copie.

### Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| `information_schema` = lecture de catalogue | **Très faible** (aucune écriture) | — |
| Confondre schéma de **staging** et de **production** | Élevée | Fixer et journaliser l'hôte `DATABASE_URL` |
| Conclure à tort « migration manquante » alors que le runtime a ajouté la colonne | Moyenne | Garder en tête la maintenance runtime (`src/lib/db.js`) |
| Le catalogue ne dit rien de l'**intention** | Moyenne | Croiser avec `docs/SCHEMA_DRIFT_AUDIT.md` et les clusters « décision produit » |

### Ce que le résultat prouverait

- La **forme réelle** du schéma (tables, colonnes, types) sur la copie.
- Les divergences **mécaniques** entre le schéma réel et ce que les migrations
  ou le code attendent.

### Ce qu'il ne prouverait PAS

- Que les migrations **reproduisent** le schéma (ordre d'application, runtime
  DDL, migrations non appliquées).
- Que le code **fonctionne** : `docs/SCHEMA_DRIFT_AUDIT.md` distingue les
  divergences purement mécaniques des clusters qui exigent une **décision
  produit** (ex. `kpi_progress`, `v2_sessions`, `v2_submissions.document_id`).
- Rien sur la production si la lecture est faite sur staging/copie.

---

## Méthode 4 — Divergences du « mode ombre »

**Statut : ❌ PROPOSÉ / À CRÉER — aucun mécanisme de mode ombre n'existe dans le
dépôt.**

### Vérification d'existence (résultat : absence)

Recherche effectuée dans tout le dépôt sur `shadow`, `mode_ombre`, `ombr`,
`dual`, `divergence`, `compare.*permission`, `legacyDecision`, `engineDecision`,
`recordDiverg` :

- **Aucune** occurrence dans `src/**` ne décrit une exécution parallèle de deux
  décisions ni une journalisation de divergence. Les correspondances de «
  shadow » sont des classes CSS (`shadow-…`), des commentaires de test
  (« shadowed names ») ou des `contexte` d'assemblage — sans rapport.
- Le seul document qui mentionne le mode ombre le classe comme **non
  implémenté** : `docs/permissions/inventaire-00-cartographie.md:131` —
  « Divergences « mode ombre » (famille A) — Nécessite d'exécuter les deux
  décisions — **Phase 5** ». La même table (`:126-133`) précise que le critère de
  sortie de la Phase 0 n'est **pas atteint** sur ce point.

> Note de précision : `src/services/authorization/legacyRoleCleanup.js:4`
> référence un document `docs/ROADMAP_ROLES_PROFILES_ACCESS.md` **absent du
> dépôt** (aucune correspondance trouvée). À ne pas citer comme source
> disponible.

**Conclusion : le mode ombre est à construire. Ce qui suit est une proposition,
pas une description d'un mécanisme existant.**

### Objectif (proposé)

Exécuter **en parallèle** l'ancienne décision (droit historique, à capacités/
rôles contextuels) et la décision du **moteur** (périmètre/capacités), et
**journaliser les divergences** — sans jamais changer le comportement observé.

### Méthode proposée

1. **Ne rien changer au résultat servi.** L'ancien chemin reste **seul** à
   décider (allow/deny). Le moteur tourne « à côté » (shadow) et son verdict est
   seulement comparé.
2. **Calculer les deux verdicts** au même point d'appel, pour la même requête
   (mêmes entrée : identité, capacité/module/action, portée, ressource).
3. **Journaliser une ligne par décision comparée** dans un journal structuré
   append-only (table dédiée ou sink de log), **sans** exposer de données
   personnelles au-delà de l'identifiant technique déjà journalisé ailleurs.
4. **Comparer** : `divergence = (legacyDecision !== engineDecision)`.
5. **Piloter par un drapeau** (feature flag) désactivé par défaut ; l'erreur de
   journalisation est **non bloquante** (fail-open).

### Champs à capturer (proposition)

| Champ | Rôle |
|---|---|
| `ts` | Horodatage (UTC) |
| `request_id` / `route` | Corrélation requête ↔ décision |
| `actor_cid` | Identité technique (pas de nom/email) |
| `module` / `capability` | La décision demandée |
| `scope` / `policy_key` / `within_scope` | Portée évaluée |
| `legacy_decision` | Verdict de l'ancien chemin (`allow`/`deny` + motif) |
| `engine_decision` | Verdict du moteur (`allow`/`deny` + motif) |
| `divergence` | Booléen `legacy != engine` |
| `resolved_from` | Source de vérité utilisée (si applicable) |

### Prérequis

1. Les **deux chemins de décision** doivent être appelables/évaluables au même
   endroit (ou exposés comme fonctions pures réutilisables).
2. Un **emplacement d'écriture** pour le journal (table append-only ou transport
   de logs) sur l'environnement **staging**.
3. Un **drapeau** d'activation/désactivation, et une convention de nommage
   (`IDENTITY_*` existant comme modèle de drapeaux dans `src/lib/identity.js`).

### Risques

| Risque | Gravité | Mitigation |
|---|---|---|
| Confondre divergence **journalisée** et décision **appliquée** | Élevée | Le chemin historique reste seul décideur ; documenter que le journal n'agit pas |
| Fuite de données personnelles dans le journal | Moyenne | Ne capturer que `cid`/ids techniques, jamais nom/email |
| Coût double (deux évaluations par appel) | Moyenne | Activer sur un périmètre restreint, mesurer, désactiver ensuite |
| Échec d'écriture qui casse une requête | Moyenne | Écriture fail-open (try/catch, jamais bloquant) |
| Fausse confiance : « pas de divergence » sur trafic non exercé | Élevée | Croiser avec un test de couverture des chemins |

### Ce que le résultat prouverait

- Où, sur le **trafic réellement observé**, l'ancienne décision et le moteur
  **divergent** (et à quelle fréquence).

### Ce qu'il ne prouverait PAS

- Que le **moteur a raison** : une divergence indique un écart, pas lequel des
  deux verdicts est correct.
- Le comportement des **chemins non exercés** (absence de divergence ≠ égalité
  partout).
- Rien sur la **production** si le mode ombre tourne sur staging.
- Rien sur les divergences de **portée** que le champ `scope` ne capturerait pas.

---

## Tableau récapitulatif — prérequis / risques

| # | Méthode | Statut | Prérequis principaux | Risques principaux |
|---|---|---|---|---|
| 1 | Inventaire des identités héritées | ✅ EXISTE (requête + outillage) | Copie hors production ; accès lecture seule ; `DATABASE_URL` → copie | Exécution accidentelle en prod ; ne pas utiliser l'endpoint nominatif (données perso) ; scripts d'écriture à éviter |
| 2 | `npm audit` | ✅ EXISTE (commande npm) | Réseau vers le registre ; `package-lock.json` ; Node ≥ 22 | Aucun fichier modifié sans `--fix` ; interprétation (DEP-1 `tar` via `unpdf → canvas`) ; faux sentiment de sécurité |
| 3 | Schéma réel vs migrations | 🟡 PARTIEL | Copie hors production ; lecture seule ; lister **les deux** dossiers de migrations | Confusion staging/prod ; maintenance runtime qui devance les migrations ; catalogue ≠ intention |
| 4 | Divergences « mode ombre » | ❌ À CRÉER | Deux décisions évaluables ; journal append-only ; drapeau off par défaut ; staging | Confondre journal et décision ; PII ; coût double ; échec d'écriture bloquant ; couverture du trafic |
