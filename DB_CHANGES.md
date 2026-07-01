# Corrections Base de Données — Sprint 01

> Toutes les corrections ont été exécutées ✅

---

## 1. Ajouter `user_name` à `error_logs`

**Exécuté le :** 2026-07-01 ✅

```sql
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
```

**Contexte :** Le code de `src/app/api/errors/route.js` insère et met à jour la colonne `user_name` dans `error_logs`, mais elle n'avait jamais été créée. Cause du Bug #1 (subtask bloquée + déconnexion).

**Statut :** ✅ Exécuté
