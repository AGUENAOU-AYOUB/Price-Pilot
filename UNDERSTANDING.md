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
- Supplements (MAD): Forsat S +0 (default/base price), Forsat M +150, Forsat L +290, Gourmette S +290, Chopard S +390, Gourmette M +550, Chopard M +750.
- Workflow: for each product tagged `brac` in collection "bracelet", set each variant price to `base_price (Forsat S) + supplement`.

#### Necklaces
- Collection "colliers", tag `nckl`.
- Chaine type supplements (MAD): Forsat S +0, Forsat M +350, Forsat L +790, Gourmette S +790, Chopard S +990, Gourmette M +1,290, Chopard M +1,890.
- Chaine size options: 41cm (default), 45, 50, 55, 60, 70, 80.
- Per-centimeter costs: Forsat S 20, Forsat M 25, Forsat L 35, Gourmette S 35, Chopard S 45, Gourmette M 55, Chopard M 70.
- Price formula: `base_price (Forsat S @ 41cm) + chain_type_supplement + (chosen_cm - 41) * per_cm_rate_for_chain_type`.

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
- Chain size adjustments mirror necklace logic using the chosen chain type's per-cm rate.
- Supplement tables inherit updates from bracelets/necklaces automatically.

## Shopify Sync Requirements
- When Forsat S price changes directly in Shopify (bracelets, necklaces, sets), automatically recalculate other variant prices using the supplement tables to keep variants in sync. The same recalculations must be applied to each variant's compare-at price.
- Exclude rings from this automatic Shopify-triggered recalculation.

## Example Calculations
- **Necklace Example**: Base price (Forsat S @ 41cm) = 2,000 MAD. Choosing Chopard M (+1,890 MAD) and 70cm adds `(70 - 41) * 70 = 2,030 MAD`. Final price = `2,000 + 1,890 + 2,030 = 5,920 MAD`.
- **Ring Example**: Base price (Small @ XS) = 4,000 MAD. Choosing Light band @ XL adds +1,400 MAD. Final price = `4,000 + 1,400 = 5,400 MAD`.
- **Set Example**: Base price (Forsat S @ 41cm) = 4,500 MAD. Choosing Chopard M chain type adds bracelet supplement (+750 MAD) and necklace supplement (+1,890 MAD). Selecting 60cm adds `(60 - 41) * 70 = 1,330 MAD`. Final price = `4,500 + 750 + 1,890 + 1,330 = 8,470 MAD`.

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
