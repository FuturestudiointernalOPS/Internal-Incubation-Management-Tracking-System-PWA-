# Inscriptions payantes LMS (checkout Kkiapay)

Un **cours LMS payant** est vendu à travers une **exécution de formulaire**
existante. Le formulaire public reste le seul point de saisie ; la même requête
crée la soumission (visible dans **Exécutions**) **et** l'inscription, puis la
fenêtre de paiement s'ouvre. L'argent est confirmé par une vérification
serveur, et l'accès est accordé ensuite.

Chaîne : `Cours → Exécution → Soumission → Inscription (référence) → Paiement → Accès (My Learning) → Reçu`

---

## 1. Variables d'environnement

À ajouter dans `.env.local` (staging) et dans l'hébergeur (production). Aucune
valeur n'est codée en dur ; sans elles, l'adaptateur **refuse d'accorder un
accès** au lieu de deviner.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY` | Clé **publique** — attribut `key` du widget, et en-tête `x-api-key` de la vérification |
| `KKIAPAY_PRIVATE_KEY` | Clé **privée** (serveur → Kkiapay) |
| `KKIAPAY_SECRET_KEY` | Clé **secrète d'API** (serveur → Kkiapay, en-tête `x-secret-key`) |
| `KKIAPAY_WEBHOOK_SECRET` | **Secret hash** défini sur le tableau de bord, à côté du webhook (en-tête `x-kkiapay-secret`). **Ce n'est PAS la clé secrète d'API.** |
| `KKIAPAY_SANDBOX` | `true` en test, `false` en production |
| `PAYMENT_PROVIDER` *(option)* | `kkiapay` par défaut |
| `PAYMENT_CURRENCY` *(option)* | `XOF` par défaut |
| `PAYMENT_AMOUNT_UNIT` *(option)* | `major` (défaut) = le prix part **tel quel** ; `minor` = le prix part **multiplié par 100** (devises à centimes) |
| `PAYMENT_AMOUNT_MULTIPLIER` *(option)* | un nombre **explicite**, quand ni `major` ni `minor` ne convient (prime sur `PAYMENT_AMOUNT_UNIT`) |
| `CHECKOUT_ACCESS_WINDOW_MINUTES` *(option)* | `15` par défaut — durée pendant laquelle l'onglet du payeur peut encore recevoir son lien d'accès |

### L'unité du montant

Le prix est **stocké en unités entières** (ce que la personne paie) et converti
**seulement aux deux bords** : ce que la fenêtre de paiement demande, et ce à
quoi la vérification est comparée. Le montant réellement demandé est **mémorisé
sur l'inscription** (`provider_amount`), donc un changement d'unité plus tard ne
peut pas invalider un paiement déjà confirmé.

Trois niveaux, du plus précis au plus général :

1. **Par cours** (onglet cours payant) : *Devise du paiement*, *Unité du montant*
   (`Unités entières` / `Unités mineures`), et *Texte du consentement*.
2. `PAYMENT_AMOUNT_UNIT` / `PAYMENT_CURRENCY` — la valeur par défaut de la plateforme.
3. `PAYMENT_AMOUNT_MULTIPLIER` — un nombre explicite, quand ni `major` ni `minor`
   ne convient.

Exemples : `major` — 25 000 XOF partent en `25000`. `minor` — 250 EUR partent en
`25000` (centimes), et la personne lit toujours « 250 ».

À vérifier une fois sur une **vraie transaction de test** avant la production.

## 2. Tableau de bord Kkiapay

Dans **Clés API → Webhook → Ajouter un webhook** :

1. **URL** : `https://<votre-domaine-impactos>/api/webhooks/kkiapay`
2. **Événements** : les deux événements de transaction (succès et échec).
3. **Secret hash** : la valeur à recopier dans `KKIAPAY_WEBHOOK_SECRET`.

Kkiapay ne réessaie qu'environ **5 fois en ~2,5 s** : une confirmation non
vérifiable n'est donc pas attendue du fournisseur. Elle est journalisée, rendue
visible dans la vue équipe, et **reprise par la réconciliation**.

## 3. Rendre une exécution payante

Dans **Admin → LMS → Inscriptions**, la carte « Rattacher un cours à une
exécution » : choisir **l'exécution**, choisir **le cours**, cliquer
**Rattacher**. Choisir « Aucun cours — formulaire gratuit » détache le cours (le
formulaire redevient gratuit, sans changement de comportement).

Le cours doit être **publié, public et payant** (prix > 0), sinon le
rattachement est refusé. L'identifiant de l'exécution se lit dans **Exécutions**
(`/platform/runs`).

La même chose par appel authentifié (capacité `lms.edit`) :

```bash
curl -X POST "https://<domaine>/api/lms/registrations?action=link-run" \
  -H "Content-Type: application/json" \
  --cookie "session=<votre cookie de session>" \
  -d '{"runId": 42, "courseId": "00000000-0000-0000-0000-000000000000"}'
```

## 4. Où voir ce qui se passe

- **Exécutions** (`/platform/runs`) : la colonne **Paiement** de chaque réponse
  dit où en est la personne. Le survol donne le montant, l'accès au cours et le
  reçu, plus la référence.
- **Admin → LMS → Inscriptions** : la vue complète — filtres par exécution,
  compteurs, dernier événement de paiement, file « à examiner », et les actions
  (relancer l'accès, renvoyer l'e-mail, rembourser).

## 5. Validation en mode test

`KKIAPAY_SANDBOX=true`, puis, avec les numéros et cartes de test Kkiapay :

| Cas | Attendu |
|---|---|
| Succès instantané | payé + accès + reçu |
| **Succès retardé (1–2 min)** | la page reste en « vérification », puis se confirme seule |
| Échec | « le paiement n'a pas abouti », **aucun** accès |
| Abandon avant paiement | inscription conservée, aucun accès |
| Nouvelle tentative après échec | **même fiche**, même référence |
| Notification reçue deux fois | aucune double inscription |
| Même personne qui recommence | réponse **neutre**, sans référence |
| Montant falsifié | refusé, journalisé |
| **Paiement confirmé, accès en échec** | reçu envoyé quand même, **aucun bouton de payer** |
| Lien d'accès expiré | « consultez votre e-mail », puis re-demande du lien |
| **Unité du montant** | à vérifier sur une vraie transaction de test (XOF, sans centimes) |

## 6. Ce qu'il faut savoir

- **Le schéma s'applique tout seul.** La migration `supabase/migrations/20260924_lms_checkout_registrations.sql` est fournie pour l'explicite, mais le code crée la colonne et les deux tables **au premier usage** (`IF NOT EXISTS`, une fois par processus) — comme le reste du projet. Aucune étape SQL manuelle n'est nécessaire.
- **Sécurité** : la référence d'une inscription **existante** n'est jamais
  renvoyée au navigateur. Le lien d'accès n'est servi que dans la fenêtre
  courte, ou par e-mail. Les codes à usage unique ne sont stockés qu'en
  **empreinte** — une fuite de base ne donne aucun lien utilisable.
- **Aucun identifiant dans les e-mails** : le lien mène à la page où la personne
  **choisit elle-même** son mot de passe.
- **Accès au cours** = se connecter et retrouver le cours dans **My Learning**.
- **Reçu** : il part dès que le paiement est confirmé, même si l'accès est encore
  en cours.
- **Réconciliation** : `POST /api/lms/registrations?action=reconcile`
  (capacité `lms.edit`) rejoue les accès échoués et revérifie les succès non
  confirmés.
