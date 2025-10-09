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
   | `SHOPIFY_WEBHOOK_SECRET` | Secret used to verify webhook signatures from Shopify |

   The Shopify values are available in the app through `import.meta.env.VITE_SHOPIFY_STORE_DOMAIN` and `import.meta.env.VITE_SHOPIFY_ACCESS_TOKEN` whenever you wire the API calls.

3. **Generate a Shopify Admin API token**

   Shopify issues Admin API tokens from a custom app inside your store. You only need to do this once per store:

   1. Sign in to your Shopify admin and open **Settings ▸ Apps and sales channels**.
   2. Click **Develop apps** (enable it if prompted) and select **Create an app**.
   3. Give the app a name such as “Price Pilot” and create it.
   4. Under **Configuration**, add the following Admin API scopes:
      - `read_products`
      - `write_products`
      - `read_product_listings`
      - `write_product_listings`
   5. Save, then go to **API credentials**, click **Install app**, and confirm.
   6. Copy the **Admin API access token** (it is shown only once) and place it in your `.env` file as `VITE_SHOPIFY_ACCESS_TOKEN`.
   7. Copy your store domain (e.g. `azorjewelry.myshopify.com`) into `VITE_SHOPIFY_STORE_DOMAIN`.

4. **Run the development server**

   ```bash
   npm run dev
   ```

   Vite will print a local URL (usually `http://localhost:5173`).

## Key concepts

- **Luxury rounding** – All computed prices are rounded to the closest value ending in `00` or `90`.
- **Supplement editors** – Modify the supplements for each variant type; hand chain values derive automatically from necklace data, and sets combine bracelet + necklace supplements.
- **Compare-at parity** – Every price update mirrors immediately to its compare-at counterpart.
- **Backups** – Trigger a backup before applying to preserve the current state. Restore at any time from the activity log panel.

## Automating Forsat S changes from Shopify

Whenever you update the **Forsat S** base price directly inside Shopify, you can forward the event to this project so that every other variant is recalculated automatically.

1. **Expose the webhook listener**

   ```bash
   npm run webhook
   ```

   The server listens on port `3000` by default. Use a tunneling service such as [ngrok](https://ngrok.com/) to expose `http://localhost:3000/webhooks/product-update` to Shopify.

2. **Capture the webhook secret** – In your Shopify custom app, open **Configuration ▸ Webhooks** and copy the signing secret. Place it in `.env` as `SHOPIFY_WEBHOOK_SECRET`.

3. **Create the webhook** – Still inside the custom app, add a **Product update** webhook and point it to the public URL from step 1. Select the same Admin API version configured in the server (defaults to `2024-04`).

4. **Trigger updates** – Whenever a product tagged `brac`, `nckl`, or `set` (and marked active) has its Forsat S variant price changed, the webhook listener:
   - locates the Forsat S + 41cm base variant,
   - recalculates every other variant using the supplement tables in `src/data/supplements.js`,
   - rounds prices to the nearest `00`/`90`,
   - mirrors the values onto `compare_at_price`, and
   - calls Shopify’s Admin API to persist the new numbers.

5. **Monitor the logs** – The listener prints a summary for each product. You can also `GET /healthz` to verify the service is alive.

> **Tip:** Adjusting supplements inside the React dashboard updates the preview state only. To keep webhook automation in sync, edit `src/data/supplements.js` (and restart the webhook server) so both paths share the same supplement values.

## Tech stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- [JavaScript (ESNext)](https://developer.mozilla.org/docs/Web/JavaScript)
- [Zustand](https://github.com/pmndrs/zustand)
- [Tailwind CSS](https://tailwindcss.com/)

---

© Azor Jewelry – Internal tooling prototype.
