# Layer split — journal (branche `frontend_b`)

> **Statut :** Fiche L1 — plateforme & formulaires publics — **terminée** :
> 10 tranches (extraction de services 1-9, découpage de vue V2 en tranche 10).
> Il manque uniquement la vérification en navigateur du découpage de vue
> (aucune session authentifiée n'était disponible pendant la session — voir
> la fin de la tranche 10). Catalogue et
> méthode : [`GUIDE_DECOUPAGE_COUCHES.md`](GUIDE_DECOUPAGE_COUCHES.md),
> [`PLAN_DE_TRAVAIL_STAGIAIRES.md`](PLAN_DE_TRAVAIL_STAGIAIRES.md),
> [`REPARTITION_STAGIAIRES.md`](REPARTITION_STAGIAIRES.md).
>
> Ce journal est propre à `frontend_b`. Il existe un journal plus avancé sur
> `origin/interns` (où `src/services/platform/**` contient déjà 20 fichiers) ;
> les deux ne sont pas synchronisés — voir la note en fin de document.

---

## 1. La cible (rappel)

```
Vue        src/app/<role>/**/page.js, src/components/**
Contrôleur src/app/api/**/route.js
Service    src/services/<domaine>/**   ← la couche nouvelle, aucun SQL
Dépôt      src/models/<domaine>/**     ← une fonction par requête
```

## 2. Le journal

### Tranche 1 — `services/platform/formRuns.js` (le cœur de L1)

**Date :** 2026-10-01. **Qui :** session assistée, périmètre L1 (plateforme &
formulaires) de `docs/REPARTITION_STAGIAIRES.md`.

**Avant.** `src/app/api/platform/form-runs/route.js` faisait 2 687 lignes :
GET/POST/PUT/DELETE (le contrôleur) **et** 12 fonctions de décision définies
inline — revue d'une soumission, e-mail de décision, document de résultat
(PDF), e-mail de résultat, purge programmée, enrichissement des assignations,
calcul de score. Zéro SQL direct (le dépôt `src/models/formRuns.js`, 978
lignes, existait déjà — la vague MVC avait déjà sorti les requêtes). Ce qui
restait mélangé, c'était la **décision**, pas la donnée.

**Tranche choisie.** Les 12 fonctions top-level utilisées par GET/POST/PUT (pas
les handlers eux-mêmes) :
`logTimeline`, `enrichAssignments`, `deriveAccountStatus`,
`calculateSubmissionScores`, `sendDecisionEmailForSubmission`,
`formatResultAnswer`, `isFounderFitResultRun`, `buildResultDocument`,
`sendResultEmailForSubmission`, `dispatchScheduledResultEmails`,
`scheduleResultSweep`, `processReviewInternal`.

**Après.**
- `src/services/platform/formRuns.js` (nouveau, ~1050 lignes) : les 12
  fonctions, **copiées à l'identique** (aucune ligne de logique réécrite),
  chacune exportée. Aucun SQL, aucun `next/server`/`NextResponse`, aucune
  lecture de `req`/`searchParams` — vérifié avant le déplacement.
- `src/app/api/platform/form-runs/route.js` : 1 709 lignes (-978). N'importe
  plus que les 12 fonctions depuis le service ; a perdu ~42 imports de modèle/
  lib devenus inutiles (confirmés par `eslint`, pas devinés).
- 5 suites de test corrigées (**source-pin**, pas de régression de
  comportement) : elles lisaient `route.js` comme du texte pour vérifier des
  invariants d'ORDRE (ex. « le refus arrive avant tout effet de bord »). Leur
  lecture pointe maintenant vers la concaténation service+route (service en
  premier, pour qu'un appel de même nom resté dans le contrôleur — l'action
  « renvoyer l'e-mail de décision » — ne soit jamais trouvé avant celui du
  service que l'assertion épingle) :
  `result-pdf-on-approval.test.js`, `result-email-schedule.test.js`,
  `result-email-founder-fit.test.js`, `run-output-instruction.test.js`,
  `run-report-file.test.js`.

**Vérifié.**
- `npm test` : 227 suites / 2 940 tests verts (avant ET après la tranche,
  mêmes effectifs).
- `npx eslint .` : 0 erreur.
- `npm run build` : vert (« Compiled successfully »).

**Pas touché (hors périmètre de cette tranche) :**
- Les branches GET/POST/PUT/DELETE elles-mêmes gardent de l'orchestration
  (lecture de paramètres, mise en forme JSON) — c'est du contrôleur légitime,
  pas de la décision à extraire plus loin sans relecture.
- `src/services/platform/import.js`, `seed.js`, `report.js` (le reste du
  couloir L1) — tranches suivantes.
- `src/app/platform/runs/page.js` (5 353 lignes, tâche V2 du catalogue) —
  tâche de vue distincte, pas touchée ici.

### Tranche 2 — le reste des actions `POST` du contrôleur

**Date :** 2026-10-01. **Qui :** même session, suite de la tranche 1.

**Avant.** `form-runs/route.js` faisait 1 677 lignes après la tranche 1 (194
`if`). Le contrôleur `POST` à lui seul regroupait 18 actions dans un seul
handler ; 9 d'entre elles portaient une vraie décision multi-étapes
(validation métier, résolution de contact, boucle de traitement par lot),
pas seulement « valider un paramètre puis appeler un modèle ».

**Tranche choisie.** Les 9 actions avec décision réelle :
`submit` (déjà vu dans le commentaire, c'est la plus dense : garde-fou d'un
run actif/non clos, règle « soumissions multiples », limite de soumissions,
score IA, évaluation IA anti-doublon, auto-approbation), `manual_add`
(résolution/création de contact, mêmes règles IA), `assign`/`unassign`,
`bulk_review`, `retry_emails`, `mark_email_cancelled`, `send_manual_message`,
`send_activation_messages`.

**Laissé tel quel (contrôleur légitime, pas une décision à extraire) :**
`status`, `launch`, `preview_result`, `regenerate_report`,
`send_result_emails`, `dispatch_scheduled_result_emails`, `delete_submission`,
`regenerate_link`, l'action de création en bas de fichier — chacune ne fait
qu'une validation simple + un ou deux appels de modèle déjà fait, enrober ça
n'aurait rien protégé de plus.

**Après.**
- `src/services/platform/formRuns.js` : +9 fonctions exportées (21 au total) —
  `submitResponse`, `manualAddSubmission`, `assignRunTargets`,
  `unassignRunTarget`, `bulkReviewSubmissions`, `retryFailedEmails`,
  `markEmailsCancelled`, `sendManualMessageToSubmissions`,
  `sendActivationMessagesToSubmissions`. Même convention de retour que
  `processReviewInternal` (`{ok, statusCode, error, ...}`). 1 784 lignes.
- `form-runs/route.js` : 1 677 → 1 061 lignes. Chaque action devenue un
  dispatcheur de 4-6 lignes (déstructurer `body`, appeler le service, mettre
  en forme la réponse) — le contrat HTTP (codes, clés JSON) est identique.
- 1 suite de test de plus corrigée (même geste qu'en tranche 1) :
  `platform-ai-evaluate-once.test.js` lisait le `.catch(() => true)` de la
  garde anti-double-évaluation, maintenant dans le service.

**Vérifié.** `npm test` : 227/227, 2 940/2 940 (mêmes effectifs qu'avant la
tranche). `npx eslint .` : 0 erreur. `npm run build` : vert.

### Tranche 3 — `src/services/platform/publicSubmit.js` (le couloir `api/s/public-submit`)

**Date :** 2026-10-01. **Qui :** même session.

**Avant.** `src/app/api/s/public-submit/route.js` (499 lignes, 44 `if`) :
point d'entrée public (sans authentification) qui mélangeait transport HTTP
(cookie de capture, en-têtes) et une décision dense — garde d'un run actif,
consentement pour une exécution payante, limitation de débit par IP,
résolution d'identité depuis les champs du formulaire, détection de doublon
avec reprise de paiement, limite de soumissions, capture du paiement,
déclenchement de l'automatisation + évaluation IA en tâche de fond.

**Après.**
- `src/services/platform/publicSubmit.js` (nouveau, 457 lignes) :
  `submitPublicForm` (toute la décision) + les aides pures déjà présentes
  (`ensurePublicSubmitSchema`, `courseSummary`, `paymentConfig`,
  `neutralCheckoutPayload`, `freshCheckoutPayload`, `preparePaidCheckout`),
  toutes déplacées à l'identique.
- `route.js` : 499 → 81 lignes. Ne garde que ce qui est vraiment HTTP : le
  cookie de capture (`readBrowserToken`/`withBrowserCookie`, qui lisent/
  écrivent directement l'objet requête/réponse) et la mise en forme finale.

**Remarque méthode.** `after()` (de `next/server`) reste dans le service : il
ne fait que planifier un rappel en tâche de fond, il ne construit aucune
réponse HTTP — même distinction déjà actée dans
`services/platform/formRuns.js` (`scheduleResultSweep`, tranche 1).

**Vérifié.** Ce couloir a un **test comportemental** réel (pas un test
épinglé sur le texte) : `lms-checkout.test.js` importe et exécute le
handler `POST` avec une fausse base de données — 34/34 avant et après,
sans aucune correction nécessaire (contrairement aux tranches 1 et 2, dont
les tests lisaient `route.js` comme du texte). `npm test` : 227/227 suites,
2 940/2 940 tests. `npx eslint .` : 0 erreur. `npm run build` : vert.

### Tranche 4 — `src/services/platform/forms.js` (`api/platform/forms`)

**Date :** 2026-10-01. **Qui :** même session.

**Avant.** 350 lignes, 33 `if`. Vérifié d'abord : `api/intents/route.js`
(423 lignes) a été **lu en entier et laissé tel quel** — ses « if » sont
presque tous des tests de présence de champ (`!== undefined`) et deux
contrôles de propriété d'une ligne ; rien à en extraire.

`forms/route.js`, lui, avait de vraies décisions : le repli sur l'instantané
publié (GET), l'algorithme de publication d'une version (POST), la garde
« un seul formulaire investisseur actif » (POST et PUT), et surtout
l'algorithme d'upsert champs/sections du constructeur (PUT) — un ordre en 4
étapes pour éviter une violation de clé étrangère (sections mises à jour →
champs mis à jour avec leur section_id neutralisé si nécessaire → sections
supprimées seulement ensuite).

**Après.**
- `src/services/platform/forms.js` (nouveau, 276 lignes) : `getFormDetail`,
  `publishFormVersion`, `createForm`, `updateFormFieldsAndSections`,
  `updateFormMetadata`, `deleteOrArchiveForm`, `guardSingleInvestorFormOnUpdate`.
- `route.js` : 350 → 169 lignes.

**Piège évité.** La garde investisseur existe **deux fois** dans le code
d'origine (une copie dans la création, une dans la mise à jour) — un test
(`investor-application-intake.test.js`) compte précisément 2 occurrences du
texte `assertSingleInvestorForm(` pour vérifier que les deux chemins sont
gardés indépendamment. Un premier essai a fusionné les deux copies en une
fonction partagée : le code était plus propre, mais ne comptait plus que 1
occurrence — le test cassait pour une bonne raison (il protège contre
l'idée qu'« un seul appel visible » suffise à prouver que les deux chemins
sont gardés). **Les deux copies ont été gardées dupliquées**, exactement
comme dans l'original, plutôt que de changer ce que le test vérifie.

**Vérifié.** `investor-application-intake.test.js` (comportemental +
source-pin) : 14/14. Suite complète : 227/227, 2 940/2 940. `npx eslint .` :
0 erreur. `npm run build` : vert.

### Tranche 5 — `src/services/platform/import.js` (`api/platform/import/execute`) — du SQL trouvé en direct dans un contrôleur

**Date :** 2026-10-01. **Qui :** même session.

**Avant.** 382 lignes, 31 `if`. **Celui-ci était différent des précédents :
il contenait du vrai SQL en direct**, dans `resolveContact` — 4
`dbClient.execute({ sql: "SELECT * FROM contacts WHERE ..." })` — la seule
route de tout le périmètre audité jusqu'ici où la vague MVC n'était pas
passée. Le reste du fichier mélangeait aussi une vraie décision : résolution
du formulaire via le run, détection de fichier déjà importé, appariement de
contact à 4 niveaux (identifiant CRM → e-mail → téléphone → nom, ce dernier
**toujours marqué incertain**, jamais fusionné silencieusement), et la
boucle d'import ligne par ligne.

**Après.**
- `src/models/platformImport.js` : +4 fonctions de dépôt — SQL copié à
  l'identique, sans une virgule changée — `findContactByCidForImport`,
  `findContactByLowerEmailForImport`, `findContactByPhoneForImport`,
  `selectAllContactsForImport`. *(Noms choisis pour matcher ceux déjà
  utilisés pour la même extraction sur `origin/interns`, slice 26 de son
  journal — pas une coïncidence, un alignement délibéré.)*
- `src/services/platform/import.js` (nouveau, 373 lignes) : `executeImport`
  (toute la décision) + `resolveContact`/`resolveRowEmail` réécrits pour
  appeler les 4 nouvelles fonctions du dépôt au lieu de `db.execute`
  directement.
- `route.js` : 382 → 36 lignes. Vérifié : **zéro** `db.`/`.execute(` restant
  dans le contrôleur.

**Vérifié.** `npm test` : 227/227, 2 940/2 940. `npx eslint .` : 0 erreur.
`npm run build` : vert. Le garde-fou automatique `services-boundaries.test.js`
(qui existe sur `origin/interns`) n'existe pas encore sur `frontend_b` — la
vérification « aucun SQL dans le service » a donc été faite manuellement, par
lecture complète du fichier et `grep`, pas par un test qui l'aurait signalé
automatiquement. Ajouter ce garde-fou serait un bon candidat de tranche
future (voir §4).

### Tranche 6 — `src/services/platform/evaluation.js` (`api/platform/ai/evaluate-submission`)

**Date :** 2026-10-01. **Qui :** même session.

**Avant.** 299 lignes, 17 `if`. Le modèle de lot (claim par expiration pour
que deux process concurrents n'évaluent jamais deux fois, appel IA borné par
un délai, comptage de progression, re-évaluation forcée) était déjà sans SQL
direct (`src/models/platformAi.js` le portait déjà) mais vivait entièrement
dans le contrôleur.

**Après.**
- `src/services/platform/evaluation.js` (nouveau, 237 lignes) :
  `ensureTables`, `cleanupExpiredClaims`, `getProgress`, `runBatch`,
  `getProgressReport`, `runEvaluationBatch`, `evaluateOneSubmission`,
  `getSubmissionEvaluation`, `hasFormAiEvaluation` — déplacées à l'identique.
- `route.js` : 299 → 108 lignes. La décision d'autorisation
  (`body.action === "progress" ? "view" : "review"`) **reste dans le
  contrôleur** : c'est la frontière HTTP elle-même (quelle capacité exiger),
  pas une décision métier à extraire.

**Vérifié.** Deux suites touchent ce fichier — `identity-gate-bridge.test.js`
(épingle la ligne d'autorisation, restée en place, donc inchangée) et
`platform-ai-evaluate-once.test.js` (lit une **vue**, pas cette route — sans
rapport) : 40/40. Suite complète : 227/227, 2 940/2 940. `npx eslint .` :
0 erreur. `npm run build` : vert.

### Tranche 7 — `src/services/platform/programEvaluation.js` (`api/evaluation`) — et l'audit de `api/run-export`

**Date :** 2026-10-01. **Qui :** même session.

**`api/evaluation`** (210 lignes, 14 `if`) avait une vraie décision : la
validation du PUT dépend du mode de notation du programme (score académique
borné 0-100, scores de dimension « incubation » bornés 1-5, liste de
dimensions lue depuis la config du programme avec un repli par défaut).
Aucun test ne référence ce fichier.
- `src/services/platform/programEvaluation.js` (nouveau, 129 lignes) :
  `getProgramConfig`, `getSubmissionEvaluationDetail`,
  `saveSubmissionEvaluation`, `configureProgramEvaluation`.
- `route.js` : 210 → 71 lignes.

**`api/run-export`** (191 lignes, 13 `if`) a été **lu en entier et laissé tel
quel** : c'est du rendu (construction d'un classeur XLSX et d'un PDF), pas une
décision métier — pas de règle d'éligibilité, pas de workflow, juste mettre en
forme les données déjà lues. Les `if` sont de la pagination PDF et du choix
de format. Rien à extraire.

**Audit rapide des petites routes restantes du couloir L1** (`platform/ai/*`,
`platform/seed/*`, `platform/integrations/*`, `platform/notifications`,
`responses*`, `respond`, `platform/collections`, `form-runs/report-file`) :
toutes font entre 36 et 354 lignes avec au plus 18 `if`. **Pas encore lues
une par une en détail** — à faire avant de clore complètement le couloir
L1, mais leur taille les rend a priori proches du cas `run-export`/`intents`
(contrôleurs déjà minces) plutôt que du cas `form-runs`/`import` (décision
dense ou SQL en direct). À vérifier, pas à supposer.

**Vérifié (tranche 7 seule).** `npm test` : 227/227, 2 940/2 940. `npx eslint
.` : 0 erreur. `npm run build` : vert.

### Tranche 8 — audit des ~19 petites routes restantes, et 2 extractions (`aiGenerate`, `emailPersonalize`, `platformRespond`)

**Date :** 2026-10-01. **Qui :** même session.

Lecture complète des routes restantes du couloir L1 (celles seulement
size/SQL-sweepées en tranche 7), jugement un par un : décision réelle mêlée au
transport → extraction ; déjà un contrôleur mince (valider → appeler un
modèle → mettre en forme) → laissé tel quel.

**Laissés tels quels (lus en entier, contrôleurs déjà minces) :**
- `api/platform/collections` (223 lignes) : CRUD classique, `slugify`, audit
  fire-and-forget, garde anti-référence-circulaire sur le parent — aucune
  règle métier multi-étapes, juste valider → appeler un modèle → répondre.
- `api/platform/ai/evaluation-scores` (233 lignes, GET seul) : agrégation de
  lecture (comptes, moyenne, respondants) déjà entièrement portée par les
  modèles ; les helpers `normalizeOptions`/`answerValue` sont de la mise en
  forme de réponse, pas une décision.
- `api/platform/form-runs/report-file` (189 lignes) : POST a un invariant
  d'ordre réel (lire l'ancien fichier avant de remplacer, ne retirer l'objet
  de stockage qu'après le nouvel upload réussi) mais GET contient
  `signRunReportFilePath` en littéral, pinné directement par
  `run-report-file.test.js` sur le fichier `route.js` (pas de wrapper
  concat) — déplacer cette ligne casserait ce test sans changer le
  comportement. Vu la taille et l'absence de vraie branche métier
  (POST/GET/DELETE sont déjà validate → modèle(s) → réponse), laissé tel
  quel plutôt que de fragmenter artificiellement GET et POST/DELETE entre
  deux couches.

**Extrait — `src/services/platform/aiGenerate.js`** (nouveau, 180 lignes) :
`api/platform/ai/generate-all` (167 lignes) mêlait le contrôleur avec un
vrai pipeline de décision : prompt IA, validation/normalisation du JSON
(valeurs par défaut des champs, options de notation, numérotation séquentielle,
normalisation des poids d'évaluation), et une création atomique en 3 étapes
(formulaire → sections/champs → framework) avec rollback du formulaire
orphelin en cas d'échec. `route.js` : 167 → 42 lignes. Aucun test ne
référence ce fichier.

**Extrait — `src/services/platform/emailPersonalize.js`** (nouveau, 232
lignes) : `api/platform/ai/personalize-template` (233 lignes) mêlait le
contrôleur avec toute la décision de personnalisation : résolution du
brouillon, ensemble des variables autorisées, verrou de langue, prompt
tier-1 (corps entier + validation structurelle), repli tier-2 déterministe
(découpage en segments), garantie finale de structure. `route.js` : 233 →
38 lignes. `ai-template-specs.test.js` lit `route.js` en brut (constante
`ROUTE`) pour vérifier des bouts du prompt tier-1 — `read()` a été changé
pour concaténer `services/platform/emailPersonalize.js` (service d'abord)
avec `route.js`, sans toucher aux assertions.

**Extrait — `src/services/platformRespond.js`** (nouveau, 132 lignes) :
`api/respond` (127 lignes) avait la décision **PUB-3** complète (ancrage
d'identité serveur email → téléphone → nom, jamais depuis le `cid` du
corps ; score de confiance ; détection de `cid` incohérent → `flagged` ;
dérivation du statut `yes`/`no`/`responded` du contact de campagne).
`route.js` : 127 → 22 lignes.
`security-request-origin-and-scope.test.js` lit `api/respond/route.js` en
brut pour vérifier `let resolvedCid = null` (et l'absence de
`let resolvedCid = cid`) — son `read()` a été changé pour prépendre
`services/platformRespond.js` quand ce chemin est demandé, sans toucher
aux assertions.

**Vérifié (tranche 8).** `npm test` : 227/227, 2 940/2 940 (inchangé).
`npx eslint .` : 0 erreur (2 warnings pré-existants `no-unused-vars` sur
`form_name`/`organization`, déjà non utilisés dans le contrôleur d'origine).
`npm run build` : vert (`✓ Compiled successfully`).

### Tranche 9 — audit du reste du couloir L1 (IA, intégrations, notifications, responses) + `services/platform/seed.js`

**Date :** 2026-10-01. **Qui :** même session.

**Laissés tels quels (lus en entier, contrôleurs déjà minces) :**
- `api/platform/ai/generate-framework`, `api/platform/ai/generate-form`,
  `api/platform/ai/analyze`, `api/platform/ai/evaluation-config`,
  `api/platform/ai/route.js` : chacun valide → appelle une fonction de
  `lib/platform/ai/**` ou un modèle → met en forme. La décision (génération
  IA, analyse) vit déjà dans `lib/platform/ai/**`, pas dans le contrôleur.
- `api/platform/integrations/calendar`, `api/platform/integrations/notion` :
  un `switch(action)` qui appelle une fonction de `lib/integrations/**` par
  action — pas de règle métier dans le contrôleur.
- `api/platform/notifications` : CRUD minimal (list / mark-read / mark-all).
- `api/responses`, `api/responses/review` : **RETIRED** (403 systématique,
  commentaire explicite "intentionally kept — set RETIRED = false to
  re-enable"). Toucher du code mort retiré intentionnellement serait du
  churn sans bénéfice ; laissé tel quel.

**Extrait — `src/services/platform/seed.js`** (nouveau, 527 lignes) :
`api/platform/seed/founder-assessment` (354 lignes) et
`api/platform/seed/investor-application` (193 lignes) contenaient chacun un
vrai pipeline de décision idempotent (upsert formulaire/collection/run,
construction des sections/champs, logique conditionnelle, publication —
pour le premier ; garde single-active-form, création form+sections+run — pour
le second), mêlé à l'auth et à la mise en forme de réponse. Ce fichier était
déjà anticipé dans le backlog (`services/platform/seed.js`, 535 lignes
estimées — 527 lignes réelles, à 8 lignes près). Moved verbatim — aucun SQL
(déjà dans `@/models/platformAi` et `@/models/investorApplication`), aucun
HTTP. L'auth (`requireAuth`, `requireSameOrigin`) reste dans les
contrôleurs :
- `founder-assessment/route.js` : 354 → 39 lignes (POST + GET CSRF-gated
  inchangés).
- `investor-application/route.js` : 193 → 37 lignes.
- `investor-application-intake.test.js` lit
  `api/platform/seed/investor-application/route.js` en brut pour vérifier
  `assertSingleInvestorForm`, `findActiveInvestorRun`,
  `investor_application: true`, etc. — son `read()` a été étendu pour
  concaténer ce chemin avec `services/platform/seed.js` (route d'abord,
  aucun ordre relatif n'est testé ici), sans toucher aux assertions.
- `security-request-origin-and-scope.test.js` vérifie `requireSameOrigin(req)`
  sur `founder-assessment/route.js` : cette ligne reste littéralement dans
  le contrôleur (frontière de transport/CSRF), donc aucune modification de
  test n'était nécessaire.

**Le couloir L1 (plateforme & formulaires publics) est maintenant
entièrement audité** : chaque route de
`src/app/api/platform/**`, `src/app/api/forms/**`, `src/app/api/s/**`,
`src/app/api/intents/**`, `src/app/api/evaluation/**`,
`src/app/api/respond/**`, `src/app/api/responses/**`,
`src/app/api/run-export/**` a été lue en entier et jugée : extraite quand une
vraie décision métier était mêlée au transport, laissée telle quelle quand le
contrôleur était déjà mince. Il ne reste que la tâche **V2** (découpage de
`src/app/platform/runs/page.js`, 5 353 lignes, en composants).

**Vérifié (tranche 9).** `npm test` : 227/227, 2 940/2 940 (inchangé).
`npx eslint .` : 0 erreur. `npm run build` : vert (`✓ Compiled successfully`).

## 3. Backlog (L1 — platform, ce qu'il reste)

| Élément | Statut |
|---|---|
| `services/platform/formRuns.js` — cluster revue/décision/e-mail/PDF | ✅ fait (tranche 1) |
| `form-runs/route.js` — les 9 actions `POST` à décision | ✅ fait (tranche 2) |
| `form-runs/route.js` — `GET` (orchestration restante, auto-close inline, agrégation du tableau des réponses) | à auditer — probablement déjà acceptable (transport + mise en forme) |
| `form-runs/route.js` — `status`, `launch`, `preview_result`, `regenerate_report`, `send_result_emails`, `dispatch_scheduled_result_emails`, `delete_submission`, `regenerate_link`, `create` | laissé tel quel (contrôleur déjà mince, voir tranche 2) |
| `services/platform/publicSubmit.js` — `api/s/public-submit` | ✅ fait (tranche 3) |
| `services/platform/forms.js` — `api/platform/forms` | ✅ fait (tranche 4) |
| `api/intents` (423 lignes) | ✅ audité, laissé tel quel — déjà un contrôleur mince (tranche 4) |
| `services/platform/import.js` — `api/platform/import/execute` | ✅ fait (tranche 5) — contenait du SQL en direct |
| Garde-fou automatique « aucun SQL / HTTP dans les services » (`services-boundaries.test.js`) | n'existe pas encore sur `frontend_b` — à porter depuis `origin/interns` |
| `services/platform/evaluation.js` — `api/platform/ai/evaluate-submission` | ✅ fait (tranche 6) |
| `services/platform/programEvaluation.js` — `api/evaluation` | ✅ fait (tranche 7) |
| `api/run-export` (191 lignes) | ✅ audité, laissé tel quel — rendu XLSX/PDF, pas une décision (tranche 7) |
| `api/platform/collections` | ✅ audité, laissé tel quel — déjà un contrôleur mince (tranche 8) |
| `api/platform/ai/evaluation-scores` | ✅ audité, laissé tel quel — lecture/agrégation pure, pas de décision (tranche 8) |
| `api/platform/form-runs/report-file` | ✅ audité, laissé tel quel — `signRunReportFilePath` pinné en littéral sur `route.js` par `run-report-file.test.js`, et pas de vraie branche métier à isoler (tranche 8) |
| `services/platform/aiGenerate.js` — `api/platform/ai/generate-all` | ✅ fait (tranche 8) |
| `services/platform/emailPersonalize.js` — `api/platform/ai/personalize-template` | ✅ fait (tranche 8) |
| `services/platformRespond.js` — `api/respond` (PUB-3) | ✅ fait (tranche 8) |
| `platform/ai/generate-framework`, `platform/ai/generate-form`, `platform/ai/analyze`, `platform/ai/evaluation-config`, `platform/ai/route.js` | ✅ audités, laissés tels quels — contrôleurs déjà minces (tranche 9) |
| `platform/integrations/calendar`, `platform/integrations/notion` | ✅ audités, laissés tels quels — dispatch par action, pas de décision (tranche 9) |
| `platform/notifications` | ✅ audité, laissé tel quel — CRUD minimal (tranche 9) |
| `api/responses`, `api/responses/review` | ✅ audités, laissés tels quels — RETIRED (403), code mort intentionnellement conservé (tranche 9) |
| `services/platform/seed.js` — `platform/seed/founder-assessment` + `platform/seed/investor-application` | ✅ fait (tranche 9) |
| **Couloir L1 — audit des contrôleurs** | ✅ **terminé** (tranches 1-9) |
| **`src/app/platform/runs/page.js`** → `src/components/platform/runs/**` (tâche **V2**) | ✅ **fait** (tranche 10) — les 6 onglets + leurs sous-composants, voir ci-dessous |
| `services/platform/report.js` (~426 lignes estimées, pas encore audité — pas de route identifiée dans le couloir L1 pour ce nom ; à vérifier contre `origin/interns` avant toute réconciliation) | non commencé / à clarifier |

### Tranche 10 — Tâche V2 : découpage de `src/app/platform/runs/page.js`

**Date :** 2026-10-02. **Qui :** même session.

`src/app/platform/runs/page.js` (5 353 lignes) était un seul composant
`FormRunsPage` avec ~100 `useState`/`useRef`, des dizaines de handlers, et un
JSX unique de six onglets (`overview`, `emails`, `share`, `assignments`,
`settings`, `templates`) + modales. Contrairement aux tranches 1-9 (extraction
de **décision** vers une couche service), ce chantier est un découpage de
**vue** React : aucune logique n'a été réécrite, seul l'endroit où le JSX et
les composants deviennent plus légers.

**Méthode.** Pour les blocs sans dépendance de fermeture (constantes,
fonctions pures, composants déjà autonomes) : extraction directe. Pour les
six onglets (fortement couplés à l'état du composant parent) : chaque onglet
devient un composant **props-driven** — aucun état ne migre, tout reste dans
`page.js`, l'onglet reçoit ce dont il a besoin en props. Pour le plus gros
bloc (`overview`, ~900 lignes référençant ~80 valeurs du parent), la liste des
variables libres a été dérivée **mécaniquement** (le fragment JSX copié tel
quel dans un composant stub à props vides, passé à `eslint --rule no-undef`)
plutôt qu'énumérée à la main — cette méthode transforme un prop oublié en
erreur de lint immédiate (« X is not defined ») plutôt qu'en bug silencieux à
l'exécution. Deux props manqués par la première passe de la sonde
(`filterRowRef`, `setFieldFilters`) ont été rattrapés par le lint final sur
le fichier assemblé.

**Fichiers créés sous `src/components/platform/runs/`:**
- `constants.js`, `helpers.js` — constantes et fonctions pures (aucune
  dépendance de fermeture).
- `RunsTable.js`, `MiniCalendar.js`, `SubmissionTimeline.js` — composants déjà
  autonomes (props uniquement), déplacés tels quels.
- `ShareTab.js`, `AssignmentsTab.js`, `SettingsTab.js` (+ `SettingRow.js`),
  `EmailsTab.js`, `TemplatesTab.js`, `OverviewTab.js` — les six onglets,
  chacun props-driven.

**`page.js` : 5 353 → 2 886 lignes** (46 % de réduction). Ce qui reste dans
`page.js` : les ~100 états, les handlers (fetch/mutations), et le JSX de
scaffolding (liste des runs, bascule d'onglets, modales globales — création
de run, review, composeur de message, ajout manuel, options d'export — qui
ne sont pas imbriquées dans un onglet et n'ont pas été touchées).

**Tests source-pin cassés et corrigés** (même mécanisme que les tranches
précédentes — `read()` étendu pour concaténer le composant déplacé, aucune
assertion modifiée) :
- `run-report-file.test.js` : `RUNS_PAGE` concatène maintenant `page.js` +
  `SettingsTab.js` + `OverviewTab.js` (le contrôle du fichier de rapport
  vit dans `SettingsTab.js`, le bouton « Regenerate » de l'aperçu vit dans
  `OverviewTab.js`).
- `result-email-schedule.test.js` : `RUNS_PAGE` concatène `page.js` +
  `TemplatesTab.js` (pin sur la déclaration module-scope de
  `RunTemplateEditor`, qui doit rester une `function` nommée — jamais une
  const locale — pour ne pas perdre le focus clavier à chaque frappe ; ce
  contrat est préservé tel quel dans `TemplatesTab.js`).

**Vérifié (tranche 10, à chaque étape).** `npm test` : 227/227, 2 940/2 940
(inchangé). `npx eslint .` : 0 erreur. `npm run build` : vert.

**Non vérifié : le rendu en navigateur.** Un serveur `npm run dev` a été
lancé et la page `/platform/runs` se charge, mais aucune session n'a pu être
authentifiée (aucun identifiant de test local n'était disponible, et
`docs/INVESTOR_OS_TEST_GUIDE.md` ne documente qu'un email, pas de mot de
passe) — donc **aucun onglet n'a été cliqué dans un navigateur réel** pour
confirmer visuellement/fonctionnellement l'absence de régression. La suite
de tests ne couvre pas le rendu de cette page (pas de tests de composants
React ici), donc c'est la seule vérification qui manque à la demande
explicite de l'utilisateur de « tester pour voir que rien n'est gâté ». À
faire dès qu'une session authentifiée est disponible : ouvrir chaque onglet,
chaque modale (review, bulk approve, envoi d'activation, envoi de résultat,
aperçu de document, composeur de message, export, templates + personalize
IA) et confirmer qu'ils se comportent comme avant.

## 4. Note — deux journaux, une divergence connue

`origin/interns` a un chantier plus avancé sur **tout** le domaine platform
(`src/services/platform/**` y compte 20 fichiers, `form-runs/route.js` n'y
fait que 795 lignes). Ce journal-ci documente un travail fait **indépendamment
sur `frontend_b`**, à la demande du propriétaire du périmètre, qui a choisi de
ne pas changer de branche. Les deux lignes de travail ne sont pas
synchronisées : avant de fusionner `frontend_b` vers `main` ou vers `interns`,
quelqu'un doit réconcilier les deux versions de `services/platform/formRuns.js`
(probablement en gardant celle qui est allée le plus loin et en relisant
l'autre pour ce qu'elle a de plus).
