# Checklist de déploiement — autorisation

À exécuter avant et après tout déploiement qui touche les droits, les profils,
l'éligibilité ou le menu. **Lecture seule** sauf l'étape d'application des
données de seed, qui est explicite.

---

## 1. Avant le déploiement — complétude de la base

```bash
npm run authz:doctor -- --strict
```

- Verdict attendu : **OK**.
- `CRITIQUE` : ne pas déployer. La base n'a pas les profils, les droits ou les
  éligibilités nécessaires ; l'application refuserait tout le monde.
- `AVERTISSEMENTS` : relire chaque ligne. Sont notamment signalés :
  - les droits du catalogue absents du profil du propriétaire ;
  - les responsabilités sans configuration ;
  - les rôles stockés hors du vocabulaire de base.

Pour cibler une base précise :

```bash
npm run authz:doctor -- --env .env.prod-verify --allow-production --strict
```

Le script affiche le projet (`postgres.<ref>`) sans jamais exposer le mot de
passe. `--allow-production` est obligatoire.

---

## 2. Données de seed — simuler, puis appliquer

La configuration initiale vit dans `src/models/authorization/seedData.js`.
L'application est **insert-only** : aucune ligne existante n'est écrasée.

```bash
# 1. Simulation (transaction annulée)
npm run authz:apply-defaults -- --details

# 2. Écriture réelle, après revue du détail
npm run authz:apply-defaults -- --apply
```

Règles :

- Ne jamais appliquer sur la production sans avoir relu le détail ligne par
  ligne.
- Une ligne « capability … » est un **droit ajouté**. Une ligne
  « eligibility … » est une **fonctionnalité ouverte** à une identité.
- Les métadonnées des responsabilités peuvent être mises à jour sans changer
  qui y a accès.

---

## 2 bis. Propriétaire — mode « même chemin »

Le mode est **désactivé par défaut**. Ne l'activer qu'après les contrôles
suivants :

1. `authz:doctor --strict` sur la cible : **OK** ;
2. photographie de production disponible ;
3. compte du propriétaire **actif** ;
4. profil par défaut du propriétaire complet (0 droit manquant).

Activation :

```bash
AUTHZ_OWNER_THROUGH_ENGINE=true
```

Après activation, relancer la photographie et comparer. Attendu : **0
régression**, et pour seuls changements les éligibilités du propriétaire qui
passent de « contournée » à explicite. Retour arrière : retirer le drapeau.

Détail : `docs/permissions/ETAPE2-OWNER-THROUGH-ENGINE.md`.

---

## 3. Après le déploiement — parité

```bash
# Nouvelle photographie + comparaison avec la référence
npm run authz:snapshot -- --compare scratch/authz-reference/<référence>.json
```

- Cible : **0 régression** (aucun droit retiré, aucune porte de menu perdue).
- Les **ouvertures** doivent être exactement celles décidées à l'étape 2.
- En production, ajouter `--env .env.prod-verify --allow-production`.

---

## 4. En cas de refus inattendu

1. `npm run authz:doctor` pour vérifier que la base est complète.
2. `npm run authz:snapshot -- --cid <identifiant>` pour la personne concernée.
3. Vérifier la source du refus : éligibilité, droit absent, blocage explicite,
   ou compte non actif.
4. Ne jamais « réparer » en ajoutant un rôle ou un cas particulier dans le code :
   la correction est une donnée, dans la base.
