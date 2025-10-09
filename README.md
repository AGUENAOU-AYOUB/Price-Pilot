# Price Pilot

A Vite + React cockpit for managing Shopify pricing strategies across bracelets, necklaces, rings, hand chains, and sets. The tool keeps prices and compare-at prices synchronized, supports preview and backup flows, and respects Azor Jewelry’s luxury rounding rules.

## Features

- 🔐 **Environment-driven login** – Username and password read from environment variables.
- 🧮 **Global percentage adjustments** – Apply rounded increases/decreases with compare-at mirroring.
- 💎 **Collection playbooks** – Dedicated pages for bracelets, necklaces, rings, hand chains, and sets.
- 🧾 **Live previews & activity log** – Inspect price/compare-at changes before applying and review actions in chronological logs.
- 💾 **Backups and restore** – One-click snapshot and rollback per workflow.
- 🌐 **English/French toggle** – Switch instantly between languages.
- 🎨 **Tailwind styling** – Responsive UI using the provided Azor Jewelry palette.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

   > If registry access is restricted, configure your npm proxy or install packages in an environment with public npm access.

2. **Configure credentials**

   Copy the example environment file and adjust the values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `VITE_APP_USERNAME` | Username required to sign in |
   | `VITE_APP_PASSWORD` | Password required to sign in |
   | `VITE_SHOPIFY_STORE_DOMAIN` | Your Shopify storefront domain (e.g. `azorjewelry.myshopify.com`) |
   | `VITE_SHOPIFY_ACCESS_TOKEN` | Admin API access token used for authenticated requests |

   The Shopify values are available in the app through `import.meta.env.VITE_SHOPIFY_STORE_DOMAIN` and `import.meta.env.VITE_SHOPIFY_ACCESS_TOKEN` whenever you wire the API calls.


3. **Run the development server**

   ```bash
   npm run dev
   ```

   Vite will print a local URL (usually `http://localhost:5173`).

## Key concepts

- **Luxury rounding** – All computed prices are rounded to the closest value ending in `00` or `90`.
- **Supplement editors** – Modify the supplements for each variant type; hand chain values derive automatically from necklace data, and sets combine bracelet + necklace supplements.
- **Compare-at parity** – Every price update mirrors immediately to its compare-at counterpart.
- **Backups** – Trigger a backup before applying to preserve the current state. Restore at any time from the activity log panel.

## Tech stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- [JavaScript (ESNext)](https://developer.mozilla.org/docs/Web/JavaScript)
- [Zustand](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com/)

---

© Azor Jewelry – Internal tooling prototype.
