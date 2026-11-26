# Étape 0 — référence et inventaire (terminé)

Statut : **terminé le 2026-11-12**. Aucun comportement applicatif n'a changé.
Aucune écriture en base.

Cette étape produit deux choses :

1. **L'inventaire statique** des décisions « qui » encore écrites dans le code.
2. **La photographie runtime** des décisions réellement rendues aujourd'hui.

Elles constituent la référence de comparaison des étapes 1 à 6.

---

## Commandes

```bash
# Inventaire statique (aucune base)
npm run authz:who-audit

# Photographie runtime (lecture seule, staging par défaut)
npm run authz:snapshot

# Comparer avec une photographie précédente
npm run authz:snapshot -- --compare scratch/authz-reference/<fichier>.json

# Photographie de production (exige le drapeau explicite)
npm run authz:snapshot -- --env .env.prod-verify --allow-production
```

---

## Ce qui a été produit

| Fichier | Contenu | Versionné |
|---|---|---|
| `docs/permissions/ETAPE0-WHOAUDIT.md` | inventaire lisible des décisions codées en dur | oui |
| `docs/permissions/ETAPE0-WHOAUDIT.json` | même inventaire, exploitable | oui |
| `docs/permissions/ETAPE0-SNAPSHOT.md` | résumé agrégé de la photographie | oui |
| `scratch/authz-reference/*.json` | détail par personne (empreintes, pas de nom) | non (local) |

La photographie contient, pour chaque personne :

- le rôle stocké et le rôle **résolu à la connexion** ;
- l'espace, les profils actifs, le profil de base et sa source ;
- les groupes effectifs ;
- l'éligibilité par fonctionnalité ;
- la matrice effective des droits ;
- le verdict et le motif pour **chaque** droit du catalogue (modules `registryOnly` inclus) ;
- le menu calculé et l'adresse d'arrivée actuels.

Les identifiants sont remplacés par une empreinte stable (`sha256`, 16 caractères)
par défaut. `--include-identifiers` les conserve. `--allow-production` est
obligatoire pour la production, et la maintenance de schéma du processus est
toujours désactivée.

---

## Résultats de l'inventaire statique

- **6** tables de menu par rôle.
- **73** destinations de menu, dont **43 sans droit déclaré**.
- **340** mentions du propriétaire, dont **101 décisions probables** dans **71 fichiers**.
- **189** comparaisons de rôle hors du moteur, dans **115 fichiers**.
- **7** marqueurs de seed exécutés au démarrage (valeurs d'accès encore fournies par le code).

Détail complet : `docs/permissions/ETAPE0-WHOAUDIT.md`.

---

## Résultats de la photographie (staging)

Cible : `postgres.mbpaxrfhqqclzyiefuab` (staging), `.env.local`.
**25 personnes** : 18 `member`, 6 `staff`, 1 propriétaire.

Deux écarts importants apparaissent, et ils sont exactement ce que l'étape 0
devait révéler :

### 1. Le propriétaire n'a pas tous les droits dans sa matrice (constat initial)

Son profil par défaut existe, mais il ne contenait pas **15 droits** que
l'application utilise aujourd'hui via des contrôles de rôle directs :

- `crm.*` (view, create, edit, delete, assign, manage) ;
- `duplicates.*` (view, resolve) et `bulk_upload.execute` ;
- `collections.*` ;
- `programs.groups`, `reports.portfolio`, `settings.manage_schema` ;
- `contacts.invite_families`.

Tant que le contournement du propriétaire existe, ces droits manquants sont
masqués. Dès qu'il est retiré (étape 2), le propriétaire les perdrait. Il faut
donc décider, droit par droit, s'ils sont **accordés** (probable) ou
**volontairement retirés**.

**Mise à jour du 2026-11-12** — les 33 lignes de configuration prévues ont été
appliquées en staging par `authz:apply-defaults --apply`. Le diagnostic
`authz:doctor` annonce désormais **0 droit manquant** pour le propriétaire. Le
constat ci-dessus reste la photographie de l'état initial.

### 2. Le CRM n'est accordé à personne dans cette base (constat initial)

Toujours en staging, **0 personne** ne détient `crm.view` / `crm.create` /
`crm.edit` / `crm.delete` / `crm.assign` / `crm.manage`. Les routes CRM
exigent pourtant ces droits. Le menu, lui, affiche le CRM parce qu'il est
encore piloté par la table de rôle. C'est un lien de menu qui mène à un refus.

La production peut différer : la photographie de production est donc
indispensable avant toute suppression de logique.

**Mise à jour du 2026-11-12** — le propriétaire détient maintenant les droits
CRM (ils font partie des 15 droits complétés). Les profils non-propriétaires
n'en détiennent toujours aucun : le CRM reste donc fermé pour eux tant qu'un
profil ou une personne ne reçoit pas ces droits. C'est exactement la règle
« éligible **et** détenteur ».

---

## Préalable à l'étape 2

Le fichier `.env.prod-verify` n'est pas présent sur ce poste. La photographie
de production doit être produite avant de retirer le contournement :

```bash
npm run authz:snapshot -- --env .env.prod-verify --allow-production
```

Puis comparer :

```bash
npm run authz:snapshot -- --compare scratch/authz-reference/<production>.json
```

Attendu : **zéro régression** (aucun droit retiré, aucune porte de menu perdue).

---

## Tâches de l'étape 1 (faites)

1. **Fait** — la configuration initiale est centralisée dans un fichier de
   données inerte (`src/models/authorization/seedData.js`).
2. **Fait** — le repli runtime de l'avertissement de responsabilité est
   supprimé ; le moteur de décision ne lit plus aucun seed (garde statique).
3. **Fait** — les 33 lignes prévues ont été appliquées en staging, dont les 15
   droits du propriétaire. Aucune perte d'accès.
4. **Fait** — la comparaison montre uniquement des ouvertures, aucune
   régression.

---

## Décisions prises (2026-11-12)

1. **Droits manquants du propriétaire** — ils peuvent être accordés plus tard :
   ce sont des données, pas du code. L'ordre sûr reste néanmoins :
   photographie de production → accorder (ou confirmer les retraits voulus) →
   comparer → retirer le contournement → comparer. Accorder **après** le retrait
   est techniquement possible, mais prive temporairement le propriétaire de ces
   droits, ce qui contredit la règle « personne ne perd d'accès ».
2. **CRM** — ouvert à ceux qui sont éligibles **et** qui détiennent les droits.
   C'est déjà la règle du moteur. L'absence de droits CRM en staging est donc un
   écart de configuration à traiter en données, pas un changement de règle.
3. **Ordre** — révisé à la demande du propriétaire : l'étape 1 a été menée sur
   staging **sans** attendre la photographie de production. L'étape 2 (retrait
   du contournement) reste, elle, conditionnée à cette photographie.

## Statut courant

**Étape 1 terminée en staging.** La base de staging est complète et les 33
lignes de configuration ont été appliquées (0 régression, ouvertures prévues).
Le fichier de lecture seule de production (`env` dédié) n'est pas présent sur
ce poste : la photographie de production et le retrait du contournement
restent en attente.
