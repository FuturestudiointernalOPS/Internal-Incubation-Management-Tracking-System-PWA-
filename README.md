# Rapport Détaillé - Fiche 3 (Mission Programmes)

Ce document trace l'ensemble du travail de découpage architectural réalisé sur le module "Programmes". L'objectif de cette mission (L4 et V16) était de déconstruire des fichiers monolithiques (front et back) pour respecter scrupuleusement le guide de séparation en couches MVC (Layer Split) imposé sur le projet ImpactOS.

---

## 1. Philosophie du refactoring (Les règles appliquées)

Avant de détailler les modifications, voici les piliers architecturaux sur lesquels je me suis basé pour chaque fichier modifié :
1. **Couche API (Contrôleurs)** : Un contrôleur (fichier `route.js`) ne doit servir que de point d'entrée HTTP. Il gère l'authentification, lit les paramètres, appelle le service et renvoie la réponse HTTP. **Aucune décision métier, ni appel SQL ne doit s'y trouver.**
2. **Couche Service (Décision)** : Toute la logique métier ("peut-il faire ça ?", vérifications, calculs, orchestration des appels) doit vivre ici. **Un service n'utilise jamais d'infrastructures HTTP (pas de NextResponse) et n'écrit jamais de SQL brut.**
3. **Couche Vues (Composants React)** : Les pages Next.js (`page.js`) du dossier `app/` doivent déléguer l'UI complexe à des composants isolés dans `src/components/`. On sépare ainsi le routage/fetching de l'affichage pur. Les textes utilisent `t()` pour l'internationalisation, les couleurs utilisent les variables CSS, et les alertes natives (`window.confirm`) sont proscrites au profit de `useDialogs()`.

---

## 2. L4 : Découpage de l'API (Couloir Décision)

Pour cette étape, j'ai analysé les routes API massives pour en extraire l'intelligence vers des fichiers de `services`.

### 2.1 Refonte de la route principale des programmes (`api/programs/route.js`)
* **Problème initial** : La route gérait le listage, la création, et l'édition avec des conditions complexes (visibilité, droits PM, statuts).
* **Découpage effectué** : J'ai créé **`src/services/programs/workspace.js`**. 
  * Le listage a été extrait vers `listProgramRecords()`.
  * La création vers `createProgramRecord()`.
  * La modification vers `updateProgramRecord()`.
* **Résultat** : La route `api/programs/route.js` a été drastiquement allégée, elle ne fait plus que le passe-plat. J'ai par ailleurs créé **`curriculum.js`** dans les services pour isoler toute la logique de structuration des sessions/modules du programme.

### 2.2 Refonte de la gestion des participants (`api/participant-programs/route.js`)
* **Problème initial** : Ce fichier gérait l'affectation et la désaffectation des participants aux programmes, l'inscription automatique aux cours LMS, la création des logs (timeline, audit) et vérifiait les conflits de facilitateurs. C'était trop lourd pour un contrôleur.
* **Découpage effectué** : J'ai créé le fichier **`src/services/programs/participantPrograms.js`**. J'y ai migré les fonctions :
  * `assignParticipantToProgramsService` (qui vérifie les `waves` de contenu, les rôles, et orchestre le LMS).
  * `removeParticipantFromProgramService`.
  * `getParticipantProgramsService`.
* **Résultat** : L'API n'a plus aucune logique conditionnelle ou de boucle de traitement.

### 2.3 Refonte de la récupération du détail participant (`api/participant/programs/[id]/route.js`)
* **Découpage effectué** : La logique extrêmement dense d'agrégation de la vue "Curriculum du participant" (assemblage des modules, KPIs, devoirs, progrès) a été extraite et encapsulée dans le service **`src/services/programs/participant.js`** via la méthode `getParticipantProgramDetailService`.

### 2.4 Refonte du Staffing (`api/v2/program-staff/route.js`)
* **Découpage effectué** : J'ai créé **`src/services/programs/programStaff.js`** pour absorber la logique d'ajout et de suppression des facilitateurs et autres staffs. Les règles de vérification de conflits (pour ne pas être facilitateur et participant à la fois) vivent maintenant dans le service.

---

## 3. V16 : Découpage des Pages d'Administration (Couloir Vues)

La partie front-end de l'administration des programmes était un immense monolithe.

### 3.1 Déconstruction du tableau de bord (`src/app/admin/programs/page.js`)
* **Problème initial** : Le fichier faisait **2 403 lignes**. Il gérait le fetching de données, la logique des modals d'édition, les formulaires, le tri, la recherche, et l'affichage des KPIs.
* **Découpage effectué** : Je l'ai découpé en trois composants majeurs situés dans `src/components/admin/programs/` :
  1. **`ProgramsTable.js`** (324 lignes) : J'y ai déplacé toute la structure du tableau, la logique d'onglets (Actifs/Archivés/Tous), et le moteur de recherche visuel.
  2. **`EditProgramModal.js`** (1 491 lignes) : J'ai isolé toute la modale de modification d'un programme. C'est un composant lourd (gestion des objectifs, de la vision, des notes de concept, des facilitateurs). Le fait de l'isoler allège complètement la page principale.
  3. **`KpiManagement.js`** (82 lignes) : J'y ai extrait le petit widget de gestion des KPIs pour pouvoir le réutiliser.
* **Résultat** : `admin/programs/page.js` est passé de 2403 lignes à **435 lignes** (82% de réduction). Il ne gère plus que l'état global et les fonctions de callback (`handleUpdate`, `handleDelete`).

### 3.2 Déconstruction de la page de Création (`src/app/admin/programs/new/page.js`)
* **Problème initial** : La page de création d'un programme faisait **1 346 lignes**, englobant tout le formulaire "Wizard" complexe.
* **Découpage effectué** : Pour respecter la séparation "Routeur VS Rendu" dictée par React Server Components, j'ai extrait l'intégralité du code d'affichage dans le composant **`src/components/admin/programs/NewProgramForm.js`**.
* **Résultat** : Le fichier `new/page.js` n'est plus qu'une coquille vide de quelques lignes qui importe le formulaire, garantissant que la route elle-même n'est pas polluée par la complexité de l'UI.

### 3.3 Déconstruction de la page de Détail (`src/app/admin/programs/[id]/page.js`)
* **Problème initial** : Le fichier de 876 lignes lisait le paramètre `[id]` de l'URL et dessinait la page.
* **Découpage effectué** : J'ai extrait la logique de présentation vers **`src/components/admin/programs/ProgramDetail.js`**.
* **Résultat** : La page `[id]/page.js` ne fait plus que lire le paramètre de l'URL pour le passer en prop au composant `ProgramDetail`.

---

## 4. Bilan et Sécurité

* **Fichiers protégés non modifiés** : Tel que demandé pour éviter tout conflit avec le Lead Dev, je n'ai touché à aucune route de `/pm`, ni `/facilitator`, ni au composant `FacilitatorsPanel.js`.
* **Qualité du code** : 
  * Toutes les chaînes utilisateur passent par le hook `useI18n` (via `t()`).
  * Les boîtes de dialogue natives proscrites utilisent le `useDialogs()` de l'application.
  * L'application a été buildée sans erreurs avec succès (`npm run build`).
