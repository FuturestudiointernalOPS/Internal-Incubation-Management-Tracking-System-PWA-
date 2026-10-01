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

## 3. Backlog (L1 — platform, ce qu'il reste)

| Élément | Statut |
|---|---|
| `services/platform/formRuns.js` — cluster revue/décision/e-mail/PDF | ✅ fait (tranche 1) |
| `form-runs/route.js` — les 9 actions `POST` à décision | ✅ fait (tranche 2) |
| `form-runs/route.js` — `GET` (orchestration restante, auto-close inline, agrégation du tableau des réponses) | à auditer — probablement déjà acceptable (transport + mise en forme) |
| `form-runs/route.js` — `status`, `launch`, `preview_result`, `regenerate_report`, `send_result_emails`, `dispatch_scheduled_result_emails`, `delete_submission`, `regenerate_link`, `create` | laissé tel quel (contrôleur déjà mince, voir tranche 2) |
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
