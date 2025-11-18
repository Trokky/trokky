---
"@trokky/core": patch
"@trokky/routes": patch
---

Correction complète du système de session "Rester connecté"

Correction majeure du mécanisme "Stay signed in" qui ne fonctionnait pas correctement :

**Problèmes résolus :**
1. Les paramètres de durée de vie des tokens dans trokky.config.ts étaient ignorés - le core utilisait des valeurs codées en dur
2. Le renouvellement des tokens ne préservait pas l'état "rememberMe" - les sessions longues étaient réduites à 2h après le premier renouvellement
3. La configuration de session Studio n'était pas exposée correctement via l'API
4. Les noms de propriétés ne correspondaient pas entre le config backend et les attentes du frontend

**Améliorations apportées :**
- Le core respecte maintenant les TTL configurés (accessTokenTtl, refreshTokenTtl, rememberMeTtl)
- Le flag rememberMe est stocké dans le payload JWT et préservé lors du renouvellement
- La configuration de session est correctement exposée à Studio via /api/config/studio
- Ajout du type tokens dans TrokkyConfig pour validation TypeScript

**Comportement attendu :**
- Sans "Stay signed in": Session de 4h (configurable via accessTokenTtl)
- Avec "Stay signed in": Session de 30 jours (configurable via rememberMeTtl)
- Les renouvellements automatiques préservent la durée de session choisie initialement
