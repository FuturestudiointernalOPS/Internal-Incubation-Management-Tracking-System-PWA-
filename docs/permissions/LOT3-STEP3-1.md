# Lot 3 — étape 3.1 : le périmètre programme suit le profil (D-4)

> Date : 2026-10-20. Décision D-4 : le périmètre d'écriture d'un programme est
> le **profil de gestionnaire**, pas une ligne d'affectation.

---

## 1. La mesure avant la bascule

Comparaison en lecture seule sur la base pointée par `.env.local` (production),
avec `scripts/db-audit/program-perimeter-compare.sql` :

| Indicateur | Valeur |
|---|---:|
| Personnes dans le périmètre actuel (« staffé sur le programme ») | **2** |
| Personnes dans le périmètre cible (profil actif) | **1** |
| Gagneraient l'accès | **0** |
| Perdraient l'accès | **1** |

La perte est **sémantique**, pas un trou de données : une facilitatrice affectée
au programme, qui n'en est pas la gestionnaire. Le gestionnaire enregistré du
programme possède bien un profil actif, valide jusqu'au 2026-10-30.

Cette personne avait déjà perdu l'écriture à l'étape 3.2 (la capacité
`programs.edit` est exigée et son profil ne la porte pas). La bascule ne lui
retire donc **aucun droit qu'elle exerçait encore** : elle aligne le périmètre
sur la capacité.

Aucune donnée nominative n'a été sélectionnée par l'audit : les identifiants
suffisent à expliquer chaque divergence.

---

## 2. Ce qui change

La garde d'écriture programme applique maintenant la politique
**« gestionnaire du programme »** au lieu de « staffé sur le programme ».

| Avant | Après |
|---|---|
| affectation au programme **ou** gestionnaire enregistré sur la fiche | profil `program_manager` actif dans le contexte du programme |

Conséquences, énoncées telles quelles :

- un programme **sans gestionnaire actif** ne peut plus être écrit que par le
  propriétaire de la plateforme ; c'est ce que la liste de travail des
  programmes non gérés sert à réparer ;
- un facilitateur affecté **n'écrit pas** dans le programme ; il conserve ses
  droits d'animation (présence, séances, correction de ses équipes) ;
- le gestionnaire assigné reçoit le profil automatiquement — rien à faire pour
  lui.

Chemin de réparation conservé : l'écran qui **désigne** un gestionnaire accepte
soit la personne qui gère déjà le programme, soit l'autorité de configuration
des accès, pour qu'un programme orphelin puisse toujours être réparé sans passer
par le propriétaire de la plateforme.

---

## 3. Mode ombre

La règle remplacée continue d'être calculée en parallèle :

- inactive par défaut ;
- activée par le drapeau d'ombre, elle journalise chaque divergence
  (ancienne règle vs règle appliquée) sans jamais changer l'issue ;
- une erreur du sondage ne change pas la décision.

Ainsi, si la mesure statique a manqué un cas en production, il apparaîtra dans
le rapport d'ombre au lieu de casser silencieusement un accès.

---

## 4. Compteurs

| Indicateur | Avant 3.1 | Après 3.1 |
|---|---:|---:|
| Politique d'écriture programme appliquée | `program_staffed` | **`program_managed`** |
| Divergence mesurée en production | — | **1** (expliquée, déjà sans droit d'écriture) |
| Gain d'accès | — | **0** |
| Politiques mesurées en ombre | 1 (profil, cible) | **1** (staffing, remplacée) |
| Appels de périmètre programme couplés à une capacité | 29 / 31 | **29 / 31** |

---

## 5. Tests

- La garde : `program-scoped-access` couvre désormais la règle appliquée, le
  mode ombre (divergence journalisée, issue inchangée) et l'échec du sondage.
- Les suites de sécurité (lots 7, 8, 9, 11, 12) et les tests de câblage
  (`program-scope-wiring`) sont alignés sur la nouvelle politique.
- `npm run test:authz` → 7 suites / 54 tests verts.
- Périmètre élargi (programmes, périmètre, équipes, groupes, KPI, soumissions,
  LMS, sécurité, phases, facilitateur, présence) → **1152 tests verts**.
- `npm run lint` → 0 erreur.
- Cliquet des permissions respecté.

---

## 6. Retour arrière

1. Remettre `program_managed` → `program_staffed` dans la garde et dans la
   décision unifiée (deux constantes), puis `git revert`.
2. Aucune écriture en base n'a été faite : les deux audits sont en lecture
   seule et n'ont créé aucun profil.

---

## 7. Compte rendu

```
LOT 3 — Un seul périmètre programme — étape 3.1
Fait :
  - comparaison en lecture seule des deux périmètres (production)
  - bascule de la garde d'écriture vers le profil de gestionnaire
  - mode ombre conservé sur la règle remplacée
  - chemin de réparation inchangé
Compteurs :
  - périmètres : 2 personnes -> 1, 1 perte expliquée, 0 gain
  - appels couplés capacité+périmètre : 29/31 (inchangé)
Divergences en mode ombre : 1 mesurée à froid, déjà sans droit d'écriture ;
  le mode ombre reste actif pour confirmer en production.
Tests ajoutés / passants : garde + ombre ; 1152 verts sur le périmètre élargi.
Décisions requises : aucune.
Retour arrière : deux constantes à inverser, ou git revert ; aucune donnée touchée.
Prochaine étape : étape 3.3 (un seul calcul d'affectation) puis 3.4 (source
  unique des droits du facilitateur, D-5).
```
