# Spike 3.4 — Validation Mécanisme Extension Print Action (FR-9)

**Date :** 2026-09-18  
**Statut :** Résolu & Documenté  
**Impacts :** Story 3.5 (`extensions/print-action`, `app/routes/app.print-document.ts`)

---

## 1. Contexte & Objectifs

La V1 de ThermoSlip doit permettre aux marchands d'imprimer des bordereaux thermiques 4×6 directement depuis la vue **Orders** native de l'admin Shopify.
Ce Spike tranche les choix d'architecture entre deux mécanismes :
- **Option A (Fallback) :** Extension d'action générique → navigation vers `/app/print?orders=...` dans l'application embeddée → `window.print()`.
- **Option B (Cible native principale) :** Extension `AdminPrintAction` (`admin.order-index.selection-print-action.render`) pointant vers une URL de document servie par l'application → affichage de l'aperçu et déclenchement d'impression natif Shopify.

---

## 2. Questions Tranchées & Résultats Techniques

### 2.1 Cible d'extension disponible dans Shopify CLI 3.94
- **Résultat :** La cible `admin.order-index.selection-print-action.render` est pleinement opérationnelle et supportée dans l'API `2026-07`.
- L'extension de type `ui_extension` se génère via le template `admin_print`.

### 2.2 Rendu HTML/CSS @page 4×6 avec AdminPrintAction (Option B)
- **Résultat :** Le composant natif `<s-admin-print-action src="...">` supporte explicitement le HTML, les PDF et les images.
- Les règles CSS `@page { size: 4in 6in; margin: 0; }` sont conservées et appliquées par le navigateur lors du déclenchement de l'impression.
- **Décision : Option B retenue comme solution principale.**

### 2.3 Format d'URL et Authentification
- Shopify recommande de passer une URL relative (ex : `/app/print-document?orders=...`).
- Lorsque le document est chargé dans le conteneur de prévisualisation, Shopify attache automatiquement le session token (JWT).
- Le backend valide la requête via `authenticate.admin(request)`.
- **Impératif CORS :** La réponse HTTP contenant le HTML statique doit obligatoirement être enveloppée par `cors(...)` fourni par `authenticate.admin(request)` afin de respecter les contraintes de sécurité d'affichage iframe dans l'admin Shopify.

### 2.4 Conception de la Route de Document : Statique vs React/Polaris
- Le guide officiel Shopify recommande que la route servant le document imprimable retourne du **HTML statique sans scripts**.
- Pour préserver les performances et la clarté de l'architecture :
  - Création d'une route ressource dédiée : `/app/print-document?orders=...`.
  - Pas de composant React côté client ni de runtime Polaris dans cette route.
  - La route `app.print.tsx` reste strictement dédiée au workflow interactif complet au sein de l'application.

### 2.5 Gestion de la Sélection et Sécurité d'Atelier
- Si plus de 50 commandes sont sélectionnées : **blocage strict** au lieu d'une troncature silencieuse.
  - Message d'alerte : `"${count} orders selected. OrderJet supports up to 50 at once. Please select 50 or fewer."`
  - `src = null`, ce qui désactive immédiatement le bouton Print natif de Shopify.
- Les paramètres d'URL sont construits de manière sécurisée via `URLSearchParams`.

### 2.6 Séparation du Statut Opérationnel "Printed"
- Shopify n'expose pas d'événement fiable permettant à l'extension de savoir si l'utilisateur a cliqué sur "Print" ou "Cancel" dans le dialogue du navigateur (le modal natif se ferme dans les deux cas).
- **Règle métier V1 :**
  - Le Print Action natif est une action d'impression pure — il **ne marque pas** automatiquement les commandes comme `Printed` dans le metafield `$app:print_status`.
  - Seul le workflow interne OrderJet (*Ready to Pack → Print → Confirm → Printed*) gère la transition d'état avec confirmation explicite.
  - Le quota Free est comptabilisé de manière déterministe par commande unique (`countedOrderIds`) afin d'éviter toute double facturation lors de ré-affichages de l'aperçu.
