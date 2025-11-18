---
"@trokky/fields": patch
"@trokky/studio": patch
---

Amélioration de l'UI/UX des champs Media et du MediaBrowser

**MediaField (@trokky/fields):**
- Remplacement des emojis par des icônes SVG personnalisées
- Section métadonnées repliable par défaut
- Labels de type média corrects (Image, Video, Audio, Document, Archive)
- Nouveau design de l'état vide aligné avec l'état rempli
- Titre du dialogue "Add media" au lieu de "Upload media"

**MediaBrowserContent (@trokky/studio):**
- Ajout de la pagination (20 éléments par page)
- Design compact avec grille 3-6 colonnes
- Thumbnails plus petits (80px de hauteur)
- Barre de recherche et pagination compactes
- Meilleure responsivité

**MediaPage (@trokky/studio):**
- Ajout de la pagination (24 éléments par page)
- Contrôles Previous/Next avec compteur de pages

**MediaBrowser Modal:**
- Modal plus compact (max-w-4xl, max-h-80vh)
- En-tête réduit pour plus d'espace de contenu
