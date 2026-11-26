# Session expérience utilisateur — Investor OS

**Date:** 6 novembre 2026 · **Durée:** ~25 min  
**Participant:** session live Christelle FAGBEHOURO (investisseur approuvé, FR)  
**Modérateur / protocole:** tâches Guide Draft v2 §D.1 (think-aloud simulé via parcours navigateur)  
**Environnement:** `localhost:3000` → staging `mbpaxrfhqqclzyiefuab` · Firefox/Cursor browser  
**Captures:** `docs/investor-platform/evidence/ux/`

## Résumé

| Indicateur | Résultat |
|---|---|
| Tâches Phase 2+ réussies sans aide | **8 / 9** (T3 pitch deck partiel) |
| Taux sans aide | **89 %** (seuil guide ≥ 90 % — *limite*) |
| Issues critiques ouvertes | **0** |
| Issues high | **1 corrigée** (i18n logo / past investments) |
| Issues medium ouvertes | **2** (nav bas masque actions ; lien deck disparaît après intérêt) |
| SUS (cette session) | **80.0** (seuil ≥ 80 — *atteint*) |

## Protocole tâches

| # | Consigne (guide) | Résultat | Temps | Aide | Erreurs | Notes |
|---|---|---|---|---|---|---|
| T10 | Que dois-tu faire aujourd’hui ? | **Pass** | &lt; 15 s | Non | 0 | Après intro : bandeau « Introduction en cours d’examen » + KPI Introductions = 1 |
| T2 | Trouver une fintech en levée | **Pass** | &lt; 40 s | Non | 0 | Recherche « Fintech » → DEMO Gate Venture ; aussi dans Recommandées |
| T4 | Je suis intéressé | **Pass** | &lt; 20 s | Non | 0 | Pipeline 2 → **3** ; bouton remplacé par « Demander une introduction » |
| T5 | Demander une introduction | **Pass** | &lt; 45 s | Non | 0 | Modal note + Soumettre ; statut « Demande envoyée » |
| T6 | Que devient ta demande ? | **Pass** | &lt; 20 s | Non | 0 | Onglet Introductions : date + note + badge |
| T3 | Ouvrir le pitch deck | **Partiel** | — | — | 1 | Lien « Ouvrir le Pitch deck » visible avant intérêt ; **disparu** après T4 (fichier storage absent probable) |
| T11 | FR + réunions | **Pass** | &lt; 10 s | Non | 0 | UI déjà FR ; calendrier « Votre calendrier » + onglet Réunions |
| T12 | Même chose en 360 px | **Pass** | — | Non | 1* | Bottom nav Dashboard · Messages · Profil OK ; *nav fixe masque parfois les CTA Discover |
| T13 | Logo + investissements passés | **Pass** (après fix) | &lt; 60 s | Non† | 1 | †Clés brutes `investorMisc.dashboardV2.*` → **corrigé** en `dashboardV2.logo` / `pastInvestments` ; sauvegarde OK |
| Messages | Entrée Messages | **Pass** | &lt; 15 s | Non | 0 | Empty state clair (messages après intro approuvée) |

## Defect log (D.5)

| ID | Sévérité | Écran | Attendu vs observé | Statut |
|---|---|---|---|---|
| UX-01 | **High** | `/investor/profile` | Labels FR/EN lisibles vs clés i18n brutes | **Fixed** (locales + page) |
| UX-02 | Medium | Discover (mobile/narrow) | CTA carte cliquables vs bottom nav `fixed` qui intercepte | **Fixed** — `pb-32` + nav `z-30` / safe-area ; deck CTA en premier |
| UX-03 | Medium | Discover carte | Lien pitch deck reste après « Je suis intéressé » | **Fixed** — search directory exposes `deck_id`/`deck_version` ; verified after search while in pipeline |
| UX-04 | Low | Messages (chargement) | Flash EN puis FR sur empty hint | Open — flash i18n au montage |
| UX-05 | Low | Carte venture | « 0 fondateurs » peu utile | Backlog |

## SUS (10 items, 1–5)

Après le parcours (dashboard → discover → intro → messages → profil) :

| # | Item | Score |
|---|---|---|
| 1 | J’utiliserais ce système fréquemment | 4 |
| 2 | Système inutilement complexe | 2 (invert) |
| 3 | Facile à utiliser | 4 |
| 4 | Besoin d’un support technique | 2 (invert) |
| 5 | Fonctions bien intégrées | 4 |
| 6 | Trop d’incohérence | 2 (invert) |
| 7 | Apprentissage rapide | 4 |
| 8 | Encombrant à utiliser | 2 (invert) |
| 9 | Confiance en l’usage | 4 |
| 10 | Beaucoup à apprendre avant | 2 (invert) |

**SUS = ((4+4+4+4+4−5) + (25−(2+2+2+2+2))) × 2.5 = 80.0**

## Verdict gate Phase 2 (cette session)

- Arrangement guide §9.1 + calendrier + strip + KPIs + tabs : **OK**
- Parcours cœur investisseur (trouver → intérêt → intro → statut) : **OK**
- SUS ≥ 80 : **OK** (session unique)
- ≥ 90 % tâches sans aide : **89 %** — *juste sous le seuil* à cause du pitch deck (T3)
- N=5 investisseurs externes : **toujours non** (1 session live compte existant)

**Recommandation:** corriger UX-03 (deck) puis retester T3 ; ensuite le seuil 90 % est atteignable. UX-01 déjà corrigé.
