# Layer split — journal (branche `frontend_b`)

> **Statut :** 1 tranche faite sur le couloir **L1 — platform**. Catalogue et
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
| ~19 petites routes restantes (`platform/ai/*`, `platform/seed/*`, `platform/integrations/*`, `platform/notifications`, `responses*`, `respond`, `platform/collections`, `form-runs/report-file`) | **non auditées en détail** — tailles mesurées (36 à 354 lignes, ≤ 18 `if`), probablement déjà minces mais à lire une par une avant de clore le couloir |
| **`src/app/platform/runs/page.js`** (5 353 lignes, tâche **V2** du catalogue) → `src/components/platform/runs/**` | **non commencé** — un chantier à part (découpage de vue React, pas extraction de service) |
| `services/platform/import.js` (609 lignes) | non commencé |
| `services/platform/seed.js` (535 lignes) | non commencé |
| `services/platform/report.js` (426 lignes) | non commencé |
| `src/app/platform/runs/page.js` → `src/components/platform/runs/**` (V2) | non commencé |
| Autres routes du couloir (`api/s/public-submit`, `api/intents`, `api/evaluation`, `api/respond`, `api/responses`, `api/run-export`, le reste de `api/platform/**`) | à délimiter (`ls`/`grep` du §1 de `PLAN_DE_TRAVAIL_STAGIAIRES.md`) |

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
