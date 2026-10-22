# Phase 1 — Synthèse des décisions validées (D1 à D10)

> Clôture de la Phase 1. Toutes les décisions **D1 à D10** ont reçu un arbitrage
> humain. **Aucun code, aucune donnée, aucune migration, aucune configuration n'a
> été modifié.** Les points « à arbitrer » des sections D1–D10 de
> `phase-1-decisions.md` sont désormais **décidés** ; ce document en est la synthèse.
> Trois points résiduels **non bloquants** restent à confirmer (voir §4).

## 1. Décisions validées

| # | Sujet | Décision | Réf. spec |
|---|---|---|---|
| **D4** | Plafond « identité ∪ fonction » | Cadre option (b) **+** lecture α : un **profil éligible ouvre** la section malgré le « non » du rôle, **avec un avertissement de SECTION**. « non » = refus par identité ; accès possible via une autre identité éligible. Retrait personnel bloquant jusqu'à restauration par le super admin. | §5.3, §16.2 |
| **D10** | Granularité d'un blocage | Blocage = **droit en entier**, **jamais** par périmètre. Restauration par le super admin. | §6.5, §16.1 |
| **D7** | Droits d'animation non consultés | **Retirer** les 6 droits accordés mais non consultés : `participants.manage`, `assignments.review`, `sessions.record`, `progress.view`, `groups.view`, `groups.manage`. Conserver `reviews.submit` (consulté). MANAGE abstrait = **pas un droit**. | §6.2, §16.1 |
| **D9** | Portée « équipe » | **Retirer** la portée « équipe » du vocabulaire (la spec ne définit que global / contextuel / personnel). | §7 |
| **D6** | Publie/inscrit (espace d'apprentissage) | **Option (i)** : accorder le **droit unique actuel** de gestion des cours via un **profil dédié**, porté par le **staff désigné** (pas tout le staff). Super admin par défaut. | §6.3, §12.4 |
| **D5** | Programme sans responsable | Un staff assigné **n'accède qu'à son programme**. Un programme **sans responsable** reste accessible **au seul propriétaire** jusqu'à assignation d'un responsable. | §7, §13 |
| **D8** | Modèle staff scindé | Un **responsable de programme** est **limité au(x) programme(s) dont il est responsable**. Le modèle « tout le portefeuille » n'est plus le défaut. | §7, §5.2 |
| **D1** | Contenu de la lecture historique | Règle **distincte**, **lecture seule** : informations générales **+ participants + documents + rapports + autres données rattachées** au programme/venture dont la personne a été manager. **Programme ET venture.** Dérogation assumée à §10.4 (participants conservés). | §10.1–10.4, §16.3 |
| **D2** | Fin de responsabilité / compte | Départ du staff ou **compte désactivé** → **perte des droits** (y compris la vue historique). **L'historique est conservé** (enregistrements gardés) **sans accès**. | §10.4, §16.4, §11 |
| **D3** | Durée et retrait de la trace | **Option (c)** : trace **révocable** **et** **durée configurable** par le super admin (heures / jours / mois / années) — **défaut 6 mois**. **Trace d'audit toujours conservée.** | §10.3, §12.5, §16.3 |

## 2. Comportements actuels à modifier (écarts confirmés)

Ces décisions impliquent des **changements de comportement** à réaliser dans les
phases suivantes (jamais un simple renommage) :

| Décision | Écart avec le code actuel | Phase concernée |
|---|---|---|
| **D4** | Le code applique « un refus explicite l'emporte » sur **toutes** les identités (`services/authorization/eligibility.js:29-36`) ; la règle arbitrée fait **ouvrir** le profil malgré le « non » du rôle, avec avertissement. | Phase 2 (caractériser) → Phase 4 |
| **D7** | 6 droits à **retirer** du catalogue + des listes à cocher + du « plein accès » ; nettoyer les octrois déjà écrits. | Phase 7 |
| **D9** | Clé de portée `team_own` et sa ligne de catalogue à **supprimer**. | Phase 7 |
| **D6** | Créer un **profil dédié** (aucun profil semé ne détient aujourd'hui le droit de gestion des cours). | Phase 7 |
| **D5 / D8** | Rendre la portée **par programme assigné** le défaut (le modèle « tout le portefeuille » reste actif aujourd'hui). | Phase 5 → Phase 7 |
| **D1 / D2 / D3** | La vue historique est aujourd'hui **sans expiration** et **sans écran de retrait** ; sa borne de contenu n'est **pas appliquée**. | Phase 7 |
| **D2** | L'**état du compte** n'est pas un préalable uniforme de la décision. | Phase 4 |

## 3. Points à intégrer à la spécification (au-delà de la spec actuelle)

Deux décisions **dérogent** ou **ajoutent** à la spec et doivent y être consignées
(Phase 9) :

- **D1** — la lecture historique **inclut les données de participants** → **déroge**
  à §10.4 (« pas d'accès automatique aux données personnelles sensibles »). À
  acter comme exception explicite.
- **D6** — création d'un **profil dédié** de gestion des cours (nom à figer) : la
  spec ne nomme personne pour publier/inscrire.
- **D4** — la règle « profil ouvre malgré le refus du rôle, avec avertissement »
  précise §16.2 (§16.2 restait ouverte).
- **D9** — retrait d'une portée non prévue par la spec (§7) : cohérent, à acter.

## 4. Points résiduels NON BLOQUANTS (à confirmer)

1. **D6** — **nom** du profil de gestion des cours (défaut proposé : « Gestionnaire
   de cours » ; alternative : réutiliser *Instructor*).
2. **D7** — portée du retrait « tout droit contenant manage » **au-delà de
   l'animation** (engineering, org_membership, crm) : **reportée**, à retraiter.
   Les droits vivants (`engineering.manage_errors`, `org_membership.manage`,
   `crm.manage`) ne sont pas concernés par le retrait déjà décidé.
3. **D8** — sous-questions : (a) lecture ou non du **catalogue** des programmes par
   un responsable ; (b) séquencement (vagues ou bascule) et critère de passage ;
   (c) cas d'un responsable de **plusieurs** programmes.
4. **D3** — titulaire du **droit de révocation** (défaut proposé : super admin).

## 5. Prochaine étape

La Phase 1 est **complète** au sens de son critère de sortie (chaque décision
validée, ajustée ou reportée). Les suites possibles :

- **Phase 2 — Filet de sécurité** : écrire les 13 scénarios de la spec §15 en tests
  (dont ceux qui encodent D4/D5/D8/D1/D2/D3), les tests de régression des 3 trous
  de portée, la règle anti-contrôle-par-rôle, le test « toute route a une décision
  ou une déclaration ».
- **Phase 3 — Urgences de sécurité** : fermer `IDOR-FOUNDER-1`, `SECRET-1`,
  `UPLOAD-1`, `BOLA-FORM-1`, et les deux actions `A_PROTEGER` (voir
  `docs/permissions/registre-vulnerabilites.md`).

Aucune phase suivante n'est engagée sans votre validation.
