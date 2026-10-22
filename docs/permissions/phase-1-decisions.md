# Phase 1 — Décisions produit à valider (D1 à D10)

> **Préparation à validation humaine. Aucun défaut recommandé n'est appliqué.**
> Chaque décision : contexte & exigences (spec v1.0) → faits confirmés dans le code
> → options → défaut recommandé → conséquences (fonctionnelles / sécurité) →
> dépendances → questions nécessitant un arbitrage humain.

Références spec : `specification_systeme_permissions.docx` (§1–§17).
Faits code : inventaires `docs/permissions/inventaire-*.md`.

---

## D1 — Portée de la lecture historique
**Exigences concernées** : spec §10.1–10.3, §16.3.

**Contexte** : après la fin d'une responsabilité de gestion, l'utilisateur peut
conserver une lecture. La spec demande de définir si cette lecture couvre **les
informations générales seulement** ou **aussi** participants, documents, rapports.

**Faits code** : la lecture résiduelle est **dérivée** d'affectations terminées et
réduite à un droit de consultation de niveau 1, sans droit d'écriture
(`services/authorization/contextGrantHistory.js` ; `docs/AUTHZ_CURRENT_STATE.md`
§F). Deux politiques de portée (`venture_managed_history`, `program_managed_history`)
sont **déclarées mais non appliquées** (inventaire C §1) — la borne de contenu n'est
donc **pas** encore imposée.

**Options** : (a) général seulement ; (b) général + participants/documents/rapports ;
(c) nuances par ressource.

**Défaut recommandé** : **(a) informations générales seulement**, aucune donnée
personnelle sensible de participants. La lecture résiduelle reste un droit
`VIEW` borné au contexte.

**Conséquences** : fonctionnel — un ancien responsable revoit l'identité/le
résumé du programme, pas les dossiers individuels. Sécurité — minimise la
persistance d'accès à des données personnelles après la fin de la mission.

**Dépendances** : conditionne la Phase 7.6 (règle d'autorisation historique
distincte) et l'écran de retrait (D3).

**À arbitrer** : le produit veut-il que l'ancien gestionnaire voie les documents
et rapports, ou seulement l'ossature ? Des données de participants sont-elles
concernées ?

### ARBITRAGE D1 — décision : option (b), règle distincte, programme ET venture

Décision :
- la lecture historique doit être une **règle distincte** des lectures actives ;
- elle couvre : **informations générales**, **participants**, **documents**,
  **rapports** et **autres données rattachées** au programme (ou à la venture)
  dont la personne a été manager ;
- elle s'applique **au programme ET à la venture**.

**⚠️ Tension avec la spec §10.4 — signalée, NON résolue** : la spec indique que
« la lecture historique d'un programme **ne donne pas automatiquement accès aux
données personnelles sensibles** qu'il contient ». Or l'option (b) inclut
explicitement les **participants**. Point à confirmer : maintient-on l'accès aux
données de participants (donc on **déroge** à §10.4), ou exclut-on les données
personnelles sensibles en gardant des informations de participants « générales » ?

**RÉSOLU par l'arbitre** : on **conserve** les informations de participants
(dérogation à §10.4 **assumée**). La vue historique donne accès au **programme dont
la personne a été manager** en **consultation seule** : elle voit le programme et
ses différentes pages, mais **ne peut rien modifier** des données présentes.
Vaut pour le programme **et** la venture. Nature : un droit de **lecture seule**,
aucune écriture.

Conséquence de mise en œuvre : la borne de contenu doit être portée par les
politiques de portée historique (`venture_managed_history`, `program_managed_history`),
aujourd'hui **déclarées mais non appliquées**. Dépend de **D3** (durée/retrait).

---

## D2 — Fin de responsabilité et désactivation de compte
**Exigences** : spec §10.4, §16.4, §11.

**Contexte** : définir si l'accès historique survit quand l'utilisateur quitte le
staff, change de rôle, ou voit son compte désactivé.

**Faits code** : la vérification d'état de compte dans la décision est **PARTIEL**
(inventaire vérifications §8) : l'état du compte n'est pas un préalable uniforme à
toute décision. Le maintien historique est aujourd'hui laissé au résidu
automatique, sans règle liant l'état du compte.

**Options** : (a) la trace s'éteint dès que le compte est désactivé ;
(b) la trace survit à la désactivation tant que la conservation l'autorise ;
(c) survit au changement de rôle sans condition.

**Défaut recommandé** : **(a)** — la trace historique est **évaluée à la décision**
et s'éteint quand le compte est désactivé ; un **changement de rôle ne la conserve
pas automatiquement**.

**Conséquences** : fonctionnel — cohérence entre « compte hors service » et
« plus d'accès ». Sécurité — ferme l'accès d'un compte désactivé, y compris pour
l'historique.

**Dépendances** : exige au préalable que l'état du compte soit un préalable de la
décision (Phase 4, spec §11). Lié à D3 (durée/retrait).

**À arbitrer** : un compte désactivé doit-il conserver une consultation historique
un certain temps (obligation de traçabilité) ou zéro accès ?

### ARBITRAGE D2 — TRANCHÉE : option (a)

Décision : si un utilisateur **quitte le staff** ou voit son **compte désactivé**,
il **perd ces droits** (y compris la vue historique). **L'historique est conservé**
— les enregistrements restent — mais **sans accès**.

Conséquence : la survie de l'accès n'est **jamais automatique** (conforme §10.4) ;
l'**état du compte** devient un préalable de la décision (spec §11, Phase 4).
La conservation des traces est assurée (aucune suppression — conforme §13).

---

## D3 — Durée et retrait de la trace historique
**Exigences** : spec §10.3, §16.3.

**Contexte** : aujourd'hui le résidu est **permanent jusqu'à retrait** et il n'existe
**aucun écran de révocation** (`docs/AUTHZ_CURRENT_STATE.md` §9, famille F).

**Faits code** : `contextGrantHistory.js` dérive le droit avec **aucune expiration** ;
la révocation n'est pas exposée.

**Options** : (a) permanence + écran de retrait ; (b) durée de conservation
configurable ; (c) les deux.

**Défaut recommandé** : **(c)** — trace **révocable par un administrateur**, avec
une **durée de conservation configurable**.

**Conséquences** : fonctionnel — le produit maîtrise la persistance. Sécurité —
réduit la surface d'accès dormant.

**Dépendances** : dépend de D1 (contenu) et D2 (état du compte). L'écran de retrait
est un livrable de Phase 7.5.

**À arbitrer** : durée par défaut ? Qui peut révoquer (super admin seul, ou porteur
du droit d'administration des permissions) ?

### ARBITRAGE D3 — TRANCHÉE : option (c)

Décision :
- la trace historique est **révocable** par un administrateur **et** **expire**
  selon une durée de conservation ;
- la durée est **configurable par le super admin**, exprimable en **heures / jours
  / mois / années** ;
- **défaut : 6 mois** ;
- **la trace d'audit est toujours conservée** même après retrait de l'accès
  (conforme §10.3 / §13).

**Reste à préciser (non bloquant)** : le titulaire exact du droit de révocation
(super admin seul, ou porteur du droit d'administration des permissions ; défaut
proposé : super admin).

---

## D4 — Plafond « identité OU fonction »
**Exigences** : spec §16.2 vs §5.3 ; §5.3 « l'éligibilité d'un profil ne contourne
pas les restrictions liées au rôle ».

**Contexte** : quand plusieurs profils donnent des éligibilités différentes,
faut-il l'union, et sous quelles limites ?

**Faits code** : la requête d'éligibilité fait un **OU** entre les identités
(rôle, groupe, profil) et un **refus explicite l'emporte**
(`services/authorization/eligibility.js:29-36`). La règle profil↔rôle **bloque**
depuis la Phase H (`profile-catalog.js:53`, `PROFILE_ROLE_ENFORCEMENT="block"`).
MAIS l'inventaire vérifications §1 signale **2 chemins d'attribution manuelle qui
échappent** à cette compatibilité.

**Options** : (a) union pure ; (b) union **bornée par le rôle** (un profil ne peut
ouvrir une section que le rôle interdit explicitement) ; (c) rôle uniquement.

**Défaut recommandé** : **(b)** — union **dans les limites du rôle** : une fonction
ne peut pas ouvrir une section que l'identité de base interdit explicitement.

**Conséquences** : fonctionnel — un participant (MEMBER) ne peut pas hériter d'une
section réservée au rôle par un profil. Sécurité — ferme l'escalade par profil.

**Dépendances** : exige de **fermer les 2 chemins d'attribution manuelle** qui
contournent la compatibilité (Phase 8.3). Lié à D8 (modèle staff).

**À arbitrer** : un profil doit-il pouvoir **élargir** au-delà du rôle, jamais
l'inverse, ou jamais élargir du tout ?

---

### ARBITRAGE D4 (recueilli — sous réserve d'un point de contradiction)

Réponses de l'arbitre :

- **Q1 (définition de « non »)** : le « non » d'éligibilité signifie que **le rôle
  OU le profil** n'a pas accès à la section.
- **Q2 / Q4 (choix de fond)** : **option (b)** — l'union est bornée par le rôle.
- **Q3 (rôle / profil)** : si le **rôle interdit une action** et qu'un **profil**
  veut l'attribuer, et que **le profil est éligible**, on accorde l'accès **avec un
  rappel / un message** signalant qu'avec le rôle détenu cette action n'est pas
  directement applicable — **non bloquant tant que soit le rôle soit le profil
  attribué est éligible**.

**Contradiction à lever (non résolue)** : la réponse Q4 (option b : « l'union est
**bornée par le rôle** ») et la réponse Q3 (« non bloquant **tant que soit le rôle
soit le profil** est éligible ») s'opposent dans le cas précis où **le rôle refuse
explicitement** et **le profil est éligible** :

- lecture **β (stricte, conforme à b)** : le « non » du rôle **bloque** ; le
  message de Q3 ne concerne qu'une **action** à l'intérieur d'une section que le
  rôle **n'interdit pas** ;
- lecture **α (souple, conforme à Q3)** : le profil **ouvre** la section malgré le
  « non » du rôle, **avec avertissement**.

Statut : **TRANCHÉE**.

Résolution :

- **Q1 (définition de « non »)** — un « non » est un refus **par identité** (le rôle
  ou le profil n'a pas accès à la section) ; l'accès reste possible dès qu'une
  autre identité est éligible.
- **Q2 / Q4** — option **(b)** retenue comme cadre général.
- **Q3 — lecture α retenue** : le « non » du rôle **ne bloque pas** une section
  qu'un **profil éligible** ouvre → **accès accordé avec un avertissement**, et
  **l'avertissement porte sur la SECTION**.
- **Blocage personnel** : si une personne est éligible **par son rôle** et qu'on
  lui **retire personnellement** un droit, elle est **bloquée dans l'emploi** de ce
  droit (qu'elle détient légitimement) **jusqu'à ce que le super admin le lui
  redonne**.

**ÉCART AVEC LE CODE ACTUEL (à caractériser en Phase 2, non corrigé)** : le code
applique aujourd'hui « **un refus explicite l'emporte** » sur **toutes** les
identités (`services/authorization/eligibility.js:29-36`) : dès qu'une ligne
porte « non », la section est refusée, quel que soit le profil. La règle arbitrée
(union + avertissement de section) **diverge** dans le cas « rôle refuse
+ profil éligible ». Le comportement actuel doit être figé par un test de
caractérisation **avant** toute bascule.

---

## D5 — Responsable de programme non enregistré
**Exigences** : spec §7 ; §13 (contrôle du périmètre).

**Contexte** : un programme en cours sans responsable enregistré ne peut être
rattaché à personne par la règle de portée.

**Faits code** : la garde exige d'être **staffé** sur le programme
(`program_staffed`, `lib/programScopedAccess.js`) ; faute de responsable enregistré,
seul le Super Admin peut écrire (`docs/AUTHZ_CURRENT_STATE.md` §12.5). Un rapport
de préparation (« programmes sans responsable ») existe.

**Options** : (a) visible/écrivable par les seuls propriétaires + alerte ;
(b) tout le staff ; (c) refus global sans alerte.

**Défaut recommandé** : **(a)** — programme accessible aux **seuls propriétaires**,
avec une **alerte d'administration « programme sans responsable »**.

**Conséquences** : fonctionnel — un programme orphelin devient un point à traiter
par l'admin. Sécurité — évite l'écriture non attribuable.

**Dépendances** : s'appuie sur le travail restant de la portée programme (Phase 5/7) ;
lié à D8.

**À arbitrer** : qui doit être alerté et à quelle fréquence ? Un programme
« terminé » est-il concerné ?

### ARBITRAGE D5 — TRANCHÉE : option (a)

Décision :
- un **membre du staff assigné** à un programme **n'a accès qu'à ce seul
  programme** (portée contextuelle stricte) ;
- un **programme sans responsable** reste accessible **au seul propriétaire**
  **jusqu'à ce qu'on lui assigne un responsable**.

Cela confirme l'option (a) : propriétaires seuls tant qu'aucun responsable n'est
enregistré, puis le responsable assigné prend le relais. L'écran « programmes sans
responsable » sert de file de travail.

**Reste à préciser (non bloquant)** : la cadence de l'alerte, et si un programme
« terminé » est concerné.

---

## D6 — Qui publie/inscrit dans l'espace d'apprentissage
**Exigences** : spec §6.3, §12.4.

**Contexte** : qui détient le droit de publier un cours / d'inscrire ?

**Faits code** : le droit correspondant (`lms.edit`) n'est détenu par **personne**
par défaut — seul le Super Admin peut publier/inscrire
(`docs/AUTHZ_CURRENT_STATE.md` §9, décision D1 de ce document).

**Options** : (a) un modèle dédié (formateur/gestionnaire de cours) ;
(b) réutiliser un modèle existant ; (c) statu quo (super admin seulement).

**Défaut recommandé** : **(a)** — un **modèle dédié** « formateur / gestionnaire de
cours », à nommer par le produit.

**Conséquences** : fonctionnel — débloque la publication sans passer par le super
admin. Sécurité — périmètre explicite.

**Dépendances** : dépend du vocabulaire de modèle (Phase 7).

**À arbitrer** : quel nom de modèle, et quels droits exacts (publier / inscrire /
attacher des ressources) ?

### ARBITRAGE D6 — décision : option (a), périmètre précisé

Décision : **publier / dépublier, inscrire un apprenant, créer des évaluations,
révoquer un certificat, attacher des ressources** sont des droits du **super admin**
par défaut. Un **membre du staff** peut **exclusivement** les recevoir : cela **ne
signifie pas que tout le staff** les détient. Un **profil dédié sera créé**, et
**seuls ceux qui portent ce profil** pourront agir.

**Point technique à trancher (ambiguïté, non résolue)** : dans le code, ces cinq
familles d'actions passent **toutes** par un **seul** droit de gestion des cours
(le module d'apprentissage n'expose aujourd'hui que voir / créer / modifier /
supprimer sous ce nom). Ce droit unique couvre **en plus** : archiver un cours,
supprimer une évaluation, vignettes, suppression de ressources. Deux lectures :

- **(i)** accorder ce droit unique via le profil → couvre la liste demandée **et**
  un peu plus (archivage, suppression d'évaluation, vignettes) ;
- **(ii)** **re-découper** en droits granulaires (publier, inscrire, évaluer,
  révoquer, ressources) → **contredit** la décision de gouvernance passée qui a
  **retiré** les droits granulaires d'apprentissage et tout ramené au droit unique.

Reste aussi à **nommer** le profil (réutiliser *Instructor*, ou créer un profil
dédié). Clarification demandée : **(i) ou (ii)**, et le nom.

### ARBITRAGE D6 — TRANCHÉE : option (i)

Décision : accorder le **droit unique actuel de gestion des cours** via un **profil
dédié**, porté uniquement par le staff désigné (pas tout le staff). Le super admin
le détient par défaut.

Conséquence assumée : le profil couvre donc la liste demandée **plus** archivage de
cours, suppression d'évaluation, vignettes et suppression de ressources (le droit
unique est indivisible pour l'instant).

**Reste à confirmer** : le **nom** du profil (défaut proposé : « Gestionnaire de
cours » ; alternative : réutiliser *Instructor*).

---

## D7 — Droits d'animation non consultés
**Exigences** : spec §6.2 (« MANAGE ne doit pas implicitement autoriser »).

**Contexte** : plusieurs capacités d'animation (programme facilitateur) sont
accordées « sur le papier » mais leur **niveau n'est jamais consulté** par la
décision — elles ne fonctionnent donc pas réellement. La spec dit que `MANAGE`
n'implique pas implicitement les autres actions.

**Faits code** : 6 capacités listées comme « assignment-only, niveau non consulté »
(`docs/AUTHZ_CURRENT_STATE.md` §7). L'action `MANAGE` est **absente** du vocabulaire
d'actions (inventaire vérifications §7).

**Options** : (a) pour chaque droit : **soit** consulter son niveau, **soit** le
retirer du catalogue ; (b) tout rendre consulté d'un bloc ; (c) statu quo.

**Défaut recommandé** : **(a) décision par droit** (consulter ou retirer), avec le
backfill de niveaux requis avant activation.

**Conséquences** : fonctionnel — fin des droits « faux ». Sécurité — chaque action
sensible reste individuellement contrôlable.

**Dépendances** : exige le backfill des niveaux par affectation (prérequis documenté
dans `AUTHZ_CURRENT_STATE.md` §7).

**À arbitrer** : pour chacun des 6 droits, consulter le niveau ou retirer ?

### ARBITRAGE D7 (partiel)

- **MANAGE** : l'arbitre indique que l'action MANAGE **n'est pas un droit
  accordable** et doit être **supprimée**. Constat code : **aucune** action
  « MANAGE » abstraite n'existe dans le vocabulaire ; en revanche des droits
  **nommés** se terminent par « .manage » (`participants.manage`, `groups.manage`)
  et un droit « manage » existe pour l'appartenance organisationnelle.
  **Clarification demandée** : la suppression vise-t-elle le seul MANAGE abstrait
  de la spec, ou aussi les droits « *.manage » concrets ?
- **`reviews.submit`** : la contradiction §7 vs §11 est **résolue par le code** —
  `reviews.submit` **est consulté** (route de revues). Il figure parmi les droits
  appliqués.
- **Census confirmé** (verrouillé par un test de contrat) :
  - **7 droits consultés** : `attendance.record`, `attendance.view`,
    `participants.view`, `sessions.conduct`, `assignments.grade`,
    `assignments.view`, `reviews.submit` ;
  - **6 droits accordés mais NON consultés** : `participants.manage`,
    `assignments.review`, `sessions.record`, `progress.view`, `groups.view`,
    `groups.manage`.

### ARBITRAGE D7 — décision : **RETIRER**

L'arbitre décide de **retirer** les 6 droits accordés mais non consultés :
`participants.manage`, `assignments.review`, `sessions.record`, `progress.view`,
`groups.view`, `groups.manage` — **ainsi que tout droit contenant « manage »**.

**Ambiguïté de portée à lever (non résolue)** : dans le code, « tout droit avec
manage » désigne :

| Droit | Module | Consulté ? | Retrait impacte |
|---|---|---|---|
| `participants.manage` | facilitator | non | animation |
| `groups.manage` | facilitator | non | animation |
| `engineering.manage_tasks` | engineering | à vérifier | exploitation engineering |
| `engineering.manage_errors` | engineering | à vérifier | exploitation engineering |
| `org_membership.manage` | org_membership | à vérifier | adhésion organisationnelle (critique) |
| `crm.manage` | crm | à vérifier (Phase 2+) | CRM |

Retirer les quatre derniers dépasse le cadre de l'animation et touche des
domaines hors spec §6.3. **Confirmation demandée** : la suppression « tout droit
avec manage » est-elle **limitée au vocabulaire d'animation** ou **globale** ?

**Nature du changement** : la suppression de vocabulaire n'est **pas** un
correctif de sécurité ; c'est un changement produit à planifier (Phase 7),
impliquant le catalogue, le test de contrat, les listes à cocher, le « plein
accès », et un **nettoyage des droits déjà écrits** par le réconciliateur.

**`reviews.submit`** : confirmé **consulté** (donc conservé).
**MANAGE abstrait** : inexistant dans le code ; à retirer du vocabulaire de la spec.

**STATUT FINAL D7 (à ce stade)** :
- **Décidé** : retirer les **6 droits d'animation accordés mais non consultés**
  (`participants.manage`, `assignments.review`, `sessions.record`, `progress.view`,
  `groups.view`, `groups.manage`).
- **NON RÉSOLU — reporté** : la portée « tout droit contenant manage » **au-delà de
  l'animation** (engineering, org_membership, crm). À retraiter plus tard ; les
  3 droits vivants (`engineering.manage_errors`, `org_membership.manage`,
  `crm.manage`) ne sont **pas** concernés par le retrait déjà décidé.
- **Conservé** : `reviews.submit` (consulté).

---

## D8 — Modèle staff scindé
**Exigences** : spec §6.3, §7, §12.

**Contexte** : les modèles du personnel/responsables accordent des droits sur **tout
le portefeuille** ; appliquer « seulement vos programmes » leur retirerait la liste
des programmes.

**Faits code** : un modèle « seulement vos programmes » est **créé mais inerte** ;
le repointage est un clic délibéré non effectué (`docs/AUTHZ_CURRENT_STATE.md`
§12.3). Un rapport d'impact existe.

**Options** : (a) activer par vagues après la migration de portée ; (b) bascule
unique ; (c) ne pas scinder.

**Défaut recommandé** : **(a) activation par vagues**, après la migration de portée
de la Phase 5, avec retour arrière.

**Conséquences** : fonctionnel — le portefeuille se resserre sans casser les écrans.
Sécurité — réduit l'accès global du staff.

**Dépendances** : **bloqué par la Phase 5** (portée) et dépend de D4/D5.

**À arbitrer** : ordre des vagues, périmètre du premier lot, critère de succès.

### ARBITRAGE D8 — TRANCHÉE (règle de portée)

Décision : un « program manager » qui reçoit des accès au programme signifie qu'il
peut être **responsable** d'un programme. Lorsqu'il est responsable, il est **limité
au seul programme dont il est responsable** (et, le cas échéant, aux programmes dont
il est responsable).

Conséquence directe : le modèle « accès à **tout** le portefeuille » ne doit plus
être le défaut ; c'est le modèle **limité au(x) programme(s) assigné(s)** qui fait
foi. Cohérent avec **D5** (un staff assigné n'accède qu'à son programme).

**Restent à préciser (non bloquant)** :
- (a) un responsable conserve-t-il une **lecture du catalogue** des programmes
  (pour découvrir/chercher), ou **strictement** son/ses programme(s) ?
- (b) **séquencement** : activation par vagues ou bascule, et **critère de passage** ?
- (c) comportement pour un responsable de **plusieurs** programmes.

---

## D9 — Portée « équipe »
**Exigences** : spec §7 (périmètre).

**Contexte** : la portée « équipe » n'est pas définie.

**Faits code** : `team_own` est **déclarée mais non implémentée** et se résout en
**refus** (`scope-catalog.js:84-89` ; inventaire C §1).

**Options** : (a) rester en refus par défaut ; (b) définir une sémantique.

**Défaut recommandé** : **(a) rester refusée par défaut** tant qu'une définition
n'est pas fournie.

**Conséquences** : sécurité — pas d'accès implicite. Fonctionnel — pas de portée
équipe tant qu'elle n'est pas spécifiée.

**Dépendances** : aucune bloquante.

**À arbitrer** : faut-il une portée équipe, et selon quelle définition ?

### ARBITRAGE D9 — **TRANCHÉE : RETIRER la portée « équipe »**

Décision : **retirer la portée « équipe » du vocabulaire**. La spec §7 ne définit
que trois portées (global, contextuel, personnel) ; « équipe » n'a pas de définition
et n'est utilisée par aucun droit. Conséquence : la clé de portée `team_own` et sa
ligne dans le catalogue des portées sont à **supprimer** (changement produit, Phase 7),
ainsi que le renvoi « équipe » dans la note de la portée affichée par le centre des
permissions. Aucun accès perdu (elle était déjà refusée).

---

## D10 — Granularité d'un blocage
**Exigences** : spec §6.5, §16.1.

**Contexte** : un blocage retire-t-il un droit entier, ou peut-il être borné à un
périmètre ?

**Faits code** : un blocage **supprime la capacité en entier** et n'est **pas levable
par re-octroi** (`services/authorization/capabilityMerge.js:78-95` ; les restrictions
sont appliquées après le merge).

**Options** : (a) conserver « droit en entier » ; (b) ajouter un blocage par portée.

**Défaut recommandé** : **(a)** — conserver « droit en entier » ; ajouter un blocage
par portée **seulement si le produit le demande**.

**Conséquences** : fonctionnel — un blocage reste fort et lisible. Sécurité — pas
de blocage partiel ambigu.

**Dépendances** : aucune.

**À arbitrer** : le produit a-t-il besoin de bloquer un droit **dans un seul
périmètre** (ex. programme A seulement) ?

### ARBITRAGE D10 (partiel — à confirmer)

Règle recueillie : un **retrait personnel** d'un droit qu'une personne détient
légitimement (par son rôle ou ses profils) **bloque l'emploi de ce droit jusqu'à
ce que le super admin le lui redonne**. Cela correspond au comportement actuel de
fond (blocage = retrait entier, non levable par re-octroi,
`capabilityMerge.js:78-95`), avec **restauration par le super admin**.

Reste à confirmer : **option (a) (droit en entier) vs (b)/(c) (blocage par
périmètre)** — le point « dans un seul périmètre » ci-dessus.

### ARBITRAGE D10 — **TRANCHÉE : blocage ENTIER**

Décision : le blocage porte sur le **droit en entier**, **jamais** par périmètre.
Confirme le comportement actuel (`capabilityMerge.js:78-95` : la restriction supprime
la capacité, appliquée après la fusion, non levable par re-octroi). Restauration par
le super admin (retrait de la restriction). Aucune option (b)/(c) retenue.

---

## Tableau de synthèse et dépendances

| # | Décision | Défaut recommandé | Dépend de |
|---|---|---|---|
| D1 | Contenu de la lecture historique | Général seulement | — |
| D2 | Fin de responsabilité / compte désactivé | Trace éteinte si compte désactivé | Phase 4 (état du compte) |
| D3 | Durée / retrait de la trace | Révocable + conservation configurable | D1, D2 |
| D4 | Plafond identité ∪ fonction | Union bornée par le rôle | Phase 8 (2 chemins manuels) |
| D5 | Programme sans responsable | Propriétaires seuls + alerte | Phase 5/7, D8 |
| D6 | Qui publie/inscrit (LMS) | Modèle dédié | Phase 7 |
| D7 | Droits d'animation non consultés | Décision par droit | Backfill des niveaux |
| D8 | Modèle staff scindé | Activation par vagues | **Phase 5**, D4, D5 |
| D9 | Portée équipe | Refus par défaut | — |
| D10 | Granularité d'un blocage | Droit en entier | — |

**Ordre de blocage** : D8 ne peut être appliquée avant la Phase 5 ; D4 avant la
Phase 8. D1→D2→D3 forment une chaîne.

## Décisions nécessitant impérativement un arbitrage humain

1. D1 — contenu de la lecture historique (données de participants ?).
2. D2 — survie de l'historique quand le compte est désactivé.
3. D3 — durée par défaut et titulaire du droit de révocation.
4. D4 — un profil peut-il élargir au-delà du rôle de base ?
5. D5 — destinataire et cadence de l'alerte « programme sans responsable ».
6. D6 — nom et périmètre du modèle « gestionnaire de cours ».
7. D7 — pour chacun des 6 droits : consulter ou retirer.
8. D8 — plan de vagues et critère de succès.
9. D9 — définir (ou non) une portée équipe.
10. D10 — besoin d'un blocage par périmètre.
