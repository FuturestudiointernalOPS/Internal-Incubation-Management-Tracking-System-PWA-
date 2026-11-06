# Vérification locale — espace investisseur

Préparé le 5 novembre 2026 pour Christelle FAGBEHOURO.

## Se connecter avec les comptes existants

1. Si le serveur est déjà lancé, ouvrir
   `http://localhost:3000/login?next=%2Finvestor%2Fdashboard`.
2. Saisir soi-même les identifiants investisseur. Ne pas les partager dans le chat,
   les documents, les captures ou un fichier suivi par Git.
3. Vérifier l'ouverture de `/investor/dashboard`. Le formulaire de connexion utilise
   `/api/auth/session-login` et une vraie session serveur : modifier `localStorage`
   ne donne pas un accès valide.
4. Pour l'administrateur, utiliser un autre profil de navigateur ou une fenêtre privée
   et ouvrir `http://localhost:3000/login?next=%2Fadmin%2Finvestors`.
   Vérifier que le compte dispose effectivement des permissions de cette rubrique.

Si localhost ne répond pas, lancer dans un terminal du projet :

```bash
cd /home/chelsea/Future_Sudio
npm run dev
```

Cette commande est une instruction manuelle, elle n'a pas été lancée par l'audit.
Utiliser le port indiqué par le terminal si 3000 est occupé, sans démarrer plusieurs
serveurs. Arrêter uniquement le serveur lancé dans ce terminal avec Ctrl+C une fois
la session terminée. Sur cette machine, éviter de lancer un build en même temps.

## Quelle base utilise localhost ?

L'adresse localhost correspond au serveur local, pas à une base locale.
La configuration `.env.local` a été vérifiée : elle pointe vers le staging
`mbpaxrfhqqclzyiefuab`. Le compte doit donc exister sur **cette base**.
Un mot de passe valide sur la production ne garantit pas un compte identique sur staging.

Ne pas remplacer `.env.local` par `.env.prod-verify` et ne pas recopier des données
de production pour faire fonctionner la connexion. Une connexion normale écrit
une session et un historique ; ce n'est pas une opération strictement en lecture seule.
Les routes peuvent aussi appeler la maintenance de schéma existante `initDb()`.

## Vérifications d'interface ajoutées — encore NOT_RUN

Le parcours d'introduction et l'accès aux decks ont évolué depuis la checklist
initiale. Les points suivants doivent être validés avec des données fictives et un
stockage de test avant toute approbation de phase :

- Dashboard investisseur : vérifier le deck depuis Discover, le détail d'une
  entreprise et Watchlist ; demander une introduction pour une entreprise déjà
  au Pipeline, puis vérifier le retrait d'une demande encore en attente.
- Administration Deal Flow : téléverser un PDF de moins de 10 Mo, le publier,
  puis vérifier l'ouverture par un investisseur autorisé et le refus d'un deck
  non publié ou d'un lien de stockage public.
- Rendez-vous : vérifier les propositions dans deux fuseaux horaires, la
  confirmation d'un seul créneau, l'absence de doublon après double soumission,
  les reports/annulations et les rappels à 24 h, 6 h et 1 h.
- Vérifier les messages de validation, d'échec de stockage et de décision dans
  les deux langues, ainsi que l'envoi contenu des courriels.

Ces vérifications n'ont pas été exécutées dans cette session. Comme `.env.local`
pointe vers le staging, ne pas lancer le serveur ni téléverser de fichier tant
qu'un environnement de test isolé n'est pas configuré ou qu'une autorisation
explicite pour ces mutations staging n'a pas été donnée.

## Point de contrôle Phase 3/4 — 6 novembre 2026

L'autorisation explicite de mutation staging a été reçue. La migration additive
`20261106_investor_phase3_4.sql` a été appliquée sur `mbpaxrfhqqclzyiefuab`.
La contrainte des statuts de réunion et les tables de créneaux/retours ont été
vérifiées en lecture seule après l'application. Le runner réinitialise le mode
de session à sa valeur héritée avant de la fermer ; aucun réglage permanent de
rôle ou de base n'a été modifié. Aucune donnée de démonstration ni aucun
courriel n'a été créé ou envoyé.

- Tests automatisés ciblés Phase 3/4 : 6 suites, 47 tests réussis.
- Frontières service/modèle : 1 029 tests réussis.
- ESLint ciblé : 0 erreur, 0 avertissement ; parité EN/FR : aucune clé manquante.
- Build de production : interrompu après cinq minutes sans progression ; **non validé**.
- Parcours navigateur, comptes fictifs, courriels sandbox et 29 lignes de
  `BASELINE_CHECKLIST.csv` : **NOT_RUN**. Le dépôt ne fournit pas de transport
  e-mail sandbox identifié ; les configurations transactionnelles existantes
  peuvent utiliser un fournisseur réel.
- Les interrupteurs `investor_introductions_v1`, `investor_messaging_v1` et
  `investor_meetings_v1` n'existent pas dans le registre staging ; les fonctions
  protégées par drapeau restent désactivées. Ils n'ont pas été activés.

Les phases 3 et 4 ne sont donc pas déclarées terminées et la phase 5 n'est pas
commencée. L'acceptation produit et les essais isolés restent nécessaires.

## Premier passage avec ton compte : observation seulement

- Vérifier les onglets disponibles : Discover, Pipeline, Watchlist et, si le
  flag est activé, Introductions.
- Ouvrir les filtres, une fiche entreprise et la comparaison si les données existent.
- Ouvrir directement `/investor/profile`, puis comparer au lien Profil de la sidebar.
- Basculer FR/EN et noter les textes non traduits.
- Noter les blocs participant encore visibles, sans changer le rôle du compte.
- Ne pas déclarer d'investissement, envoyer d'introduction, approuver une candidature,
  modifier des données ou déclencher d'email sur les enregistrements existants.

Ce passage ne remplace pas les tests avec données fictives. Pour les mutations,
il faut des comptes et entreprises de démonstration et un envoi d'emails contenu.

## Relever les résultats

Utiliser `BASELINE_CHECKLIST.csv` dans ce dossier. Pour chaque exécution, noter :
compte fictif utilisé (alias seulement), navigateur, langue, largeur, résultat observé
et référence de capture. Réaliser deux passages distincts.

Les 29 lignes restent NOT_RUN dans le fichier tant que l'exécution n'est pas
observée. Un échec de l'existant doit être noté FAIL avec son symptôme ; ne pas
le transformer en PASS parce qu'un test automatisé passe.

Les captures partagées doivent utiliser des données fictives ou masquer noms,
emails et numéros réels. Ne jamais partager de cookies de session, jetons ou HAR
brut : ils peuvent contenir des identifiants et des réponses confidentielles.

## Conditions avant la phase suivante

Le guide v2 demande l'approbation du responsable produit de la référence initiale
et des données de démonstration avant la phase 1. Les écarts de schéma et de droits
constatés sont documentés dans `PHASE_0_COMPATIBILITY_REVIEW.md` ; leur correction
reste à concevoir et tester, sans supprimer ni renommer les structures existantes.
