# Répartition fonctionnelle — les 7 tâches, les 7 stagiaires

> **Compagnons de :** [`REPARTITION_STAGIAIRES.md`](REPARTITION_STAGIAIRES.md)
> (répartition *refactor* / couloirs) et
> [`PLAN_DE_TRAVAIL_STAGIAIRES.md`](PLAN_DE_TRAVAIL_STAGIAIRES.md)
> (catalogue des tâches de découpage).
>
> Ce document-ci est une répartition **fonctionnelle** : il attribue les **7 tâches
> produit** demandées aux stagiaires, d'après **ce que chacun a dit vouloir
> apprendre** dans `Internship.csv`. Ce n'est pas la même chose que le découpage en
> couches : ici, on parle de *features à livrer*, pas de *fichiers à déplacer*.

**Règle de lecture :** une personne = un **propriétaire** unique par tâche. Deux
tâches peuvent toucher le même module (le tableau de bord Venture) ; dans ce cas la
fiche précise **qui touche quel fichier** pour éviter le conflit.

---

## 1. Ce que chaque stagiaire a demandé (source : `Internship.csv`)

| Stagiaire | À l'aise en | Veut apprendre | Trois skills visés | Projet à explorer | Point fort déclaré |
|---|---|---|---|---|---|
| **Alexis ASSOGBA** | Front-end | **Backend** | English, **UI/UX**, IA | Projets IA | Frontend + aime documenter |
| **SOTINKON Comblé** | Front-end | **Software Architecture** | English, IA, gestion du temps/pression | Projets IA | Repère les bugs (« testing things ») |
| **Aïchath RAMANOU** | **Backend** (tout *Advanced*) | **Software Architecture** | English, organization | **CRM** | Apprend vite, mène une feature de bout en bout |
| **FAGBEHOURO Christelle** | Backend | **DevOps / CI-CD** | **Performance analytics**, manipulation de données | DevOps, mobile | Diagnostique un incident en prod (méthode structurée) |
| **chris-mael GOUGBE** | Front-end | **Teamwork methodologies** | Stress, charge de travail, travail d'équipe | Cybersécurité | Détermination ; UI/UX & APIs *Advanced* |
| **Harry HOUNSOU** | Backend | **Security** | Problem solving, **security**, frontend | Cybersécurité | Envie d'apprendre |
| **ADONON joakh** | **Recherche & Documentation** | **APIs** | Frontend, backend, performance | Cybersécurité | Curiosité, résout les problèmes |

---

## 2. Les 7 tâches → les 7 stagiaires (vue d'un coup d'œil)

| # | Tâche | Propriétaire | Pourquoi ce binôme |
|---|---|---|---|
| **E** | Connecter le site Future Studio à ImpactOS — intégration API | **Aïchath RAMANOU** | Architecture logicielle (sa demande n°1) + feature de bout en bout (son propre objectif « du début à la fin ») + backend *Advanced* |
| **A** | Venture dashboard : **responsivité + Statistiques** | **Alexis ASSOGBA** | Front-end (son confort) + UI/UX (son objectif) ; la partie statistiques l'ouvre au **backend** qu'il veut apprendre |
| **B** | Venture dashboard : **sections + rendre dynamique** | **chris-mael GOUGBE** | Front-end + UI/UX *Advanced* ; coordination avec A = pratique du **teamwork** qu'il veut apprendre |
| **C** | Venture projet : **envoi d'e-mails aux membres de la Venture** | **FAGBEHOURO Christelle** | Backend + chaîne de livraison (logs, retries → lien avec son intérêt **DevOps** et *performance/data*) |
| **D** | CRM : **ajouter le « cc » à l'envoi d'e-mail** | **Harry HOUNSOU** | Backend + *problem solving* ; la validation des destinataires = volet **sécurité** qu'il veut explorer |
| **F** | **Revue** de LMS et Launch Lab | **SOTINKON Comblé** | Son point fort = *repérer les bugs* ; une revue donne la vue **architecture** qu'il veut apprendre, en lecture seule |
| **G** | **Définir proprement les Investisseurs** | **ADONON joakh** | Recherche & Documentation (son confort) ; « définir » = enquête + rédaction, exactement sa force |

> **Personne n'est obligé d'avoir une tâche.** Si la capacité est plus faible,
> **C + D** peuvent fusionner (même métier : e-mail) et **F** peut repasser au lead.
> Le tableau ci-dessus est le plein emploi, pas un quota.

---

## 3. Fiches par tâche

### Fiche E — Connecter le site Future Studio à ImpactOS (intégration API)

**Propriétaire :** Aïchath RAMANOU.
**But :** faire dialoguer le site public Future Studio et ImpactOS via l'API
publique existante (le site nomme un programme, ImpactOS répond avec l'exécution
qui le vend et son prix).

**Périmètre (à toi) :**
- Routes : `src/app/api/public/**` (`course-match`, `checkout`, `register`,
  `group-info`).
- Modèles liés : `src/models/lms/courseMatch.js`, `src/models/lms/checkoutStore.js`.
- Doc d'entrée : `docs/PHASE6_7_REPORT.md` (§ E. Commercial Flow).

**Pourquoi toi :** c'est la tâche la plus **architecturale** et la plus « bout en
bout » — comprendre la demande, concevoir, coder, tester, livrer. C'est mot pour mot
ton objectif de stage et ton point fort.

**Terminé quand :** le site obtient un *match* fiable et un *checkout* cohérent ; le
format des réponses **ne change pas** ; tests + `npm run lint` + `npm run build` verts.

---

### Fiche A — Venture dashboard : responsivité + Statistiques

**Propriétaire :** Alexis ASSOGBA.
**But :** rendre le tableau de bord Venture utilisable sur tous les écrans
(responsive) et y ajouter une vraie section **Statistiques**.

**Périmètre (à toi) :**
- `src/components/ventures/VentureDashboard.js` et
  `src/components/ventures/venture-dashboard/` — **fichiers de la « colonne
  statistiques » uniquement** (ex. `MetricsColumn.js`, `HealthSummary.js`,
  `WidgetCard.js`).
- Lecture seule sur `src/services/ventures/analytics.js` (les agrégats existent
  déjà : réutilise-les, ne les réécris pas).
- Mise en forme des graphes dans **ton** dossier
  `src/components/ventures/venture-dashboard/stats/`.

**Pourquoi toi :** front-end (ton confort) + UI/UX (ton objectif). Les statistiques
te font toucher aux **données/backend**, ce que tu veux apprendre.

**Terminé quand :** le dashboard ne casse plus sur mobile/tablette ; la section
Statistiques affiche des chiffres réels ; aucun hex en dur (variables CSS) ; textes
via `t()` en `en` **et** `fr`.

---

### Fiche B — Venture dashboard : sections + rendre dynamique

**Propriétaire :** chris-mael GOUGBE.
**But :** structurer le dashboard en **sections** claires et le brancher
**dynamiquement** sur l'API (plus de sections figées).

**Périmètre (à toi) :**
- `src/components/ventures/venture-dashboard/` — **fichiers de structure et de
  chargement** (ex. `DashboardHeader.js`, `QuickActions.js`,
  `ActivityColumn.js`, `TeamCoachingColumn.js`) ; nouveaux morceaux dans **ton**
  dossier `src/components/ventures/venture-dashboard/sections/`.
- Contrat de données : `src/app/api/ventures/[id]/dashboard/route.js` (lecture ;
  chaque section se charge indépendamment — conserve ce comportement).
- ⚠️ **Ne touche pas** aux fichiers « statistiques » de Alexis (`MetricsColumn.js`,
  `HealthSummary.js`). Répartition : *toi = structure/dynamique*, *Alexis =
  responsive/statistiques*.

**Pourquoi toi :** front-end + UI/UX *Advanced*. La coordination fine avec Alexis
est exactement le **travail d'équipe** que tu veux apprendre.

**Terminé quand :** chaque section est un composant autonome alimenté par l'API ;
l'échec d'une section ne casse pas les autres ; textes via `t()` (`en` + `fr`).

---

### Fiche C — Venture projet : envoi d'e-mails aux membres de la Venture

**Propriétaire :** FAGBEHOURO Christelle.
**But :** permettre d'envoyer un e-mail aux membres d'une Venture depuis l'espace
projet (rappel de tâche/jalon, message aux membres).

**Périmètre (à toi) :**
- Composants : `src/components/ventures/projects/` (`VentureRemindersPanel.js`,
  `WorkItemReminderBar.js`).
- Décision : `src/services/reminders/**` (`engine.js`, `recipients.js`, `rules.js`).
- Transport : `src/lib/email/senders/reminders.js` (réutilise `sendEmail`).
- Données : `src/models/ventureAssigneeEmails.js`, `src/models/ventureReminders.js`.

**Pourquoi toi :** backend (ton confort). La livraison fiable (journalisation,
échappement, reprise) est un premier pas vers la **fiabilité/observabilité** — ton
angle DevOps.

**Terminé quand :** un envoi réel part vers les bonnes adresses ; un échec
d'envoi est **visible** (jamais un faux succès) ; adresses « placeholder » jamais
émises ; tests verts.

---

### Fiche D — CRM : ajouter le « cc » à l'envoi d'e-mail

**Propriétaire :** Harry HOUNSOU.
**But :** pouvoir mettre des destinataires en **copie (cc)** lors de l'envoi d'un
message depuis le CRM.

**Périmètre (à toi) :**
- Transport : `src/lib/email/send.js`, `src/lib/email/delivery.js`,
  `src/lib/mailer.js` (ajouter le champ `cc`).
- Route : `src/app/api/contact-emails/route.js`.
- Interface : `src/components/messaging/chat/ComposeMessageModal.js` (champ cc).
- ⚠️ Fichiers partagés avec la fiche C (`send.js`) : **coordonne-toi avec
  Christelle** avant de modifier le transport. Le plus simple : le « cc » est un
  ajout additif à la signature existante.

**Pourquoi toi :** backend + *problem solving*. Valider les adresses en copie
(ne jamais envoyer à une adresse interne « placeholder ») est le volet
**sécurité** que tu veux explorer.

**Terminé quand :** le champ cc est présent dans l'interface, transmis à l'API et
au fournisseur ; une adresse invalide est refusée proprement ; textes via `t()`.

---

### Fiche F — Revue de LMS et Launch Lab

**Propriétaire :** SOTINKON Comblé.
**But :** **auditer** le module d'apprentissage (LMS) et la fonctionnalité
**Launch Lab** : est-ce que ça marche, qu'est-ce qui manque, quels sont les bugs ?

**Périmètre (lecture d'abord, correctifs ensuite) :**
- Écrans : `src/app/admin/lms/**`, `src/app/pm/lms/**`.
- Composants : `src/components/lms/**`.
- Modèles : `src/models/lms/**` (dont `courseMatch.js` pour Launch Lab).
- Docs : `docs/LMS_ARCHITECTURE.md`, `docs/PHASE3_LMS_RETIRED_GOVERNANCE.md`.

**Méthode recommandée :**
1. **Phase 1 (lecture seule) :** écrire un rapport — ce qui fonctionne, ce qui est
   cassé, ce qui manque. Aucune modification de code tant que le lead n'a pas
   validé la liste.
2. **Phase 2 :** corriger uniquement les points validés, un correctif = un commit.

**Pourquoi toi :** ton point fort est de **repérer les bugs avant qu'ils
n'arrivent** ; une revue te donne la vue **architecture** que tu veux acquérir,
sans risque au démarrage.

**Terminé quand :** un rapport de revue est livré ; les correctifs validés sont en
place ; `npm run lint` + `npm run build` verts.

---

### Fiche G — Définir proprement les Investisseurs

**Propriétaire :** ADONON joakh.
**But :** clarifier et **définir** ce qu'est un Investisseur dans le produit : rôles,
statuts, cycle de vie, ce qui lui appartient — puis aligner le code et la doc.

**Périmètre (toi) :**
- Documentation de référence : `docs/INVESTOR_OS_TEST_GUIDE.md`,
  `docs/INVESTOR_OS_USER_WORKFLOW.md`, `docs/INVESTOR_DASHBOARD_CARDS.md`.
- Écrans : `src/app/admin/investors/**`, `src/app/investor/**`.
- API/modèles : `src/app/api/investor/**`, `src/models/investor/**`.

**Livrable principal :** un document de définition (« Qu'est-ce qu'un investisseur —
rôles, états, permissions, parcours ») **puis** les écarts code ↔ doc à corriger.

**Pourquoi toi :** Recherche & Documentation (ton confort) et « résoudre des
problèmes » (ton rôle) ; ce travail est d'abord une **enquête + rédaction**.

**Terminé quand :** la définition est écrite et validée par le lead ; les écarts
identifiés sont listés (et corrigés si le périmètre le permet).

---

## 4. Ce qui va ensemble (pour éviter les conflits)

| Zone partagée | Qui touche quoi |
|---|---|
| `src/components/ventures/venture-dashboard/` | Alexis = `MetricsColumn.js`, `HealthSummary.js`, `stats/` · chris-mael = structure, `sections/`, chargement |
| `src/lib/email/send.js`, `delivery.js` | Christelle = expéditeurs/décision · Harry = ajout du champ `cc` (additif, à coordonner) |
| `src/app/api/public/**` | Aïchath (intégration site) — SOTINKON **ne fait que lire** pour la revue LMS |

**Filet de sécurité :** tout dossier **non listé** dans ce document reste au **lead**.
Un stagiaire ne prend donc jamais un dossier « oublié ».

---

## 5. Angle « sécurité » (les 3 stagiaires qui l'ont demandé)

**Harry**, **chris-mael** et **ADONON** ont tous mis la cybersécurité dans leurs
envies. Aucune des 7 tâches n'est *purement* sécurité, mais chacune offre un angle
réel à traiter **en plus** de la feature :

| Stagiaire | Son angle sécurité à couvrir |
|---|---|
| Harry (D) | Validation des destinataires `cc` : jamais d'envoi à une adresse interne/placeholder |
| chris-mael (B) | Revue des dépendances et des données exposées par chaque section du dashboard |
| ADONON (G) | Périmètre d'accès des investisseurs : qui voit quoi, et pourquoi |

---

## 6. Récapitulatif final (à afficher au mur)

```
E. Intégration site ↔ ImpactOS ......... Aïchath
A. Dashboard Venture — responsive/stats  Alexis
B. Dashboard Venture — sections/dyn. ... chris-mael
C. Venture — e-mails aux membres ....... Christelle
D. CRM — « cc » sur l'e-mail ........... Harry
F. Revue LMS + Launch Lab .............. SOTINKON
G. Définir les Investisseurs ........... ADONON
                                          (lead : sauvegarde + validation)
```
