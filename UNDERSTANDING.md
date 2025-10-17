# Project Understanding

## High-Level Goals
- Build a Vite + React application styled with Tailwind CSS.
- Provide authenticated access with environment-configured credentials and support English/French localization.
- Optimize UX/UI for responsiveness, speed, and adherence to the provided color palette and branding (including logo integration).

## Core Features
### Global Price Adjustment Page
- Fetch all active Shopify products and adjust their prices by a chosen percentage.
- Round adjusted prices to the nearest value ending in `.00` or `.90` (e.g., 1,587 → 1,590; 1,596 → 1,600).
- Display previews showing old vs. new prices (including compare-at prices) before applying updates.
- Apply identical adjustments to each variant's compare-at price whenever the primary price changes (including during backups and restores).
- Provide explicit controls for preview, applying updates, and backing up prices prior to changes.
- Show real-time logs and loading states to prevent duplicate submissions and monitor progress.

### Jewelry Category Management Hub
- Present five sub-pages (Bracelets, Necklaces, Rings, Hand Chains, Sets) under a second top-level page.
- Each sub-page processes only active Shopify products within a specific collection and tag (e.g., Bracelets: collection "bracelet" with tag "brac").
- Use configurable supplement tables (stored in JSON and editable in the UI) to calculate Shopify variant prices from base (default) variants.
- Provide preview, backup, apply actions, real-time logs, and guarded loading states across all sub-pages.
- Recompute and display compare-at prices alongside every price calculation to keep them synchronized.

#### Bracelets
- Chain variants: Forsat S (default), Forsat M, Forsat L, Gourmette S, Chopard S, Gourmette M, Chopard M.
- Supplements (MAD): Forsat S +0, Forsat M +150, Forsat L +290, Gourmette S +290, Chopard S +390, Gourmette M +550, Chopard M +750.
- Pricing workflow:
  - If the product exposes only the `Chain Variants` option, Forsat S keeps the product price and every other chain type adds its supplement.
  - If the product has `Chain Variants` plus another option (excluding `Taille de chaine`) with a single value, that value’s Forsat S price becomes the base for all chain variants on the product.
  - If the product has `Chain Variants` plus another option with multiple values, each value maintains its own Forsat S base price; other chain variants under the same value add their supplements to that base.
  - Compare-at prices follow the same base + supplement logic.

#### Necklaces
- Collection "colliers", tag `nckl`.
- Chain size options: 41cm (default), 45, 50, 55, 60, 70, 80.
- Each chain type has an explicit size matrix (see `src/data/supplements.js`). Supplements listed below already include the 41cm base adjustment and should be added directly to the Forsat S 41cm price:
  - Forsat S: 41 → 0, 45 → 180, 50 → 280, 55 → 380, 60 → 560, 70 → 780, 80 → 980.
  - Forsat M: 41 → 180, 45 → 265, 50 → 365, 55 → 465, 60 → 665, 70 → 865, 80 → 1 065.
  - Forsat L: 41 → 440, 45 → 545, 50 → 665, 55 → 785, 60 → 1 005, 70 → 1 205, 80 → 1 405.
  - Gourmette S: 41 → 460, 45 → 565, 50 → 685, 55 → 805, 60 → 1 025, 70 → 1 225, 80 → 1 425.
  - Chopard S: 41 → 590, 45 → 705, 50 → 845, 55 → 995, 60 → 1 255, 70 → 1 505, 80 → 1 755.
  - Gourmette M: 41 → 790, 45 → 925, 50 → 1 085, 55 → 1 265, 60 → 1 585, 70 → 1 885, 80 → 2 185.
  - Chopard M: 41 → 1 090, 45 → 1 255, 50 → 1 445, 55 → 1 665, 60 → 2 005, 70 → 2 305, 80 → 2 605.
- Price formula: `final_price = forsat_s_41cm_price + chain_type_size_supplement`.

#### Rings
- Collection "BAGUES", tag `rng`.
- Ring sizes: XS (46-49), S (50-54), L (55-59), XL (60-65).
- Band types: Small, Light, Big with tiered supplements (MAD):
  - Small: XS +0, S +300, L +500, XL +700.
  - Light: XS +0, S +600, L +900, XL +1,400.
  - Big: XS +0, S +1,000, L +1,500, XL +2,000.
- Price formula: `base_price (Small @ XS) + band_type_size_supplement`.

#### Hand Chains
- Share chain types with necklaces but supplements multiplied by 1.5 (e.g., Chopard S becomes 990 * 1.5 = 1,485 MAD).
- Default variant Forsat S aligns with product base price.

#### Sets
- Collection "ensemble", tag `set`.
- Chain type supplement equals `bracelet_chain_type_supplement + necklace_chain_type_supplement`.
  - Chain size adjustments mirror the necklace size matrix for the selected chain type.
- Supplement tables inherit updates from bracelets/necklaces automatically.

## Shopify Sync Requirements
- When Forsat S price changes directly in Shopify (bracelets, necklaces, sets), automatically recalculate other variant prices using the supplement tables to keep variants in sync. The same recalculations must be applied to each variant's compare-at price.
- Exclude rings from this automatic Shopify-triggered recalculation.
- Provide a webhook listener (`npm run webhook`) that ingests Shopify `product/update` events, verifies the HMAC secret, and persists the recalculated prices via the Admin API.

## Example Calculations
- **Necklace Example**: Base price (Forsat S @ 41cm) = 2,000 MAD. Choosing Chopard M @ 70 cm adds +2,305 MAD from the matrix. Final price = `2,000 + 2,305 = 4,305 MAD`.
- **Ring Example**: Base price (Small @ XS) = 4,000 MAD. Choosing Light band @ XL adds +1,400 MAD. Final price = `4,000 + 1,400 = 5,400 MAD`.
- **Set Example**: Base price (Forsat S @ 41cm) = 4,500 MAD. Choosing Chopard M chain type adds bracelet supplement (+750 MAD) and necklace supplement (+2,005 MAD for 60 cm). Final price = `4,500 + 750 + 2,005 = 7,255 MAD`.

## UX/UI Expectations
- Tailwind-driven responsive layout with polished interactions, loaders, and status logs.
- Utilize provided color palette and logo (from azorjewelry.com) prominently.
- Dashboard landing page greets the authenticated user by username.
- Provide bilingual support (EN/FR) with the ability to toggle languages.

## Performance & Reliability Notes
- Implement rate-limit-aware batching and robust error handling for Shopify API interactions.
- Ensure backups are created and recoverable before applying pricing changes.
- Include progress indicators to avoid duplicate requests and keep users informed.

## Next Steps (Upon Approval)
- Scaffold Vite + React + Tailwind project with authentication shell.
- Model supplement tables and Shopify service layer for price calculations.
- Design UI flows for preview/apply/backup processes and logging console.
- Integrate localization, theming, and logo assets.
