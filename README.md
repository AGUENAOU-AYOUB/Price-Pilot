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

> **Note:** The codebase is intentionally JavaScript-only. No `.ts`, `.tsx`, or declaration files are used so the project aligns with the requested stack.

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
   | `SHOPIFY_ACCESS_TOKEN` | Admin API access token for server-side requests (never prefixed with `VITE_`) |
   | `VITE_SHOPIFY_PROXY_URL` | Base URL for the proxy server (e.g. `http://localhost:4000/api/shopify`) |
   | `SHOPIFY_WEBHOOK_SECRET` | Secret used to verify webhook signatures from Shopify |
   | `SHOPIFY_PROXY_PORT` | Port used by the product proxy server (defaults to `4000`) |
   | `SHOPIFY_PROXY_BASE_PATH` | URL path prefix for proxy routes (defaults to `/api/shopify`) |
   | `SHOPIFY_PROXY_ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the proxy |

   The frontend only reads `import.meta.env.VITE_SHOPIFY_STORE_DOMAIN` and `import.meta.env.VITE_SHOPIFY_PROXY_URL`. The Admin API token stays server-side as `SHOPIFY_ACCESS_TOKEN`.

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
   6. Copy the **Admin API access token** (it is shown only once) and place it in your `.env` file as `SHOPIFY_ACCESS_TOKEN`.
   7. Copy your store domain (e.g. `azorjewelry.myshopify.com`) into `VITE_SHOPIFY_STORE_DOMAIN`.

4. **Start the Shopify product proxy**

   ```bash
   npm run shopify:proxy
   ```

   The server listens on the port configured by `SHOPIFY_PROXY_PORT` (default
   `4000`) and exposes REST endpoints under
   `SHOPIFY_PROXY_BASE_PATH` (default `/api/shopify`). Keep this process running
   so the frontend can load products. Set
   `SHOPIFY_PROXY_ALLOWED_ORIGINS` to the URLs that should be able to call the
   proxy (e.g. `http://localhost:5173`).

5. **Run the development server**

   ```bash
   npm run dev
   ```

   Vite will print a local URL (usually `http://localhost:5173`).

### How the proxy fixes the eight-product limit

The React app no longer calls Shopify’s Admin REST API directly from the
browser. Instead, `src/services/shopify.js` requests
`<SHOPIFY_PROXY_URL>/products`, which is handled by the Express server in
`shopify/productProxyServer.js`. The proxy injects the Admin API token from
server-side environment variables, iterates through every page of products, and
returns normalized results back to the UI. Because the API call originates from
your backend, Shopify’s CORS restrictions no longer apply and the dashboard now
receives the full active catalog instead of falling back to the bundled
eight-item mock list.

### Persisting ring price updates

When you click **Apply** on the Rings page, the UI now posts the recalculated
variant prices to the proxy’s `POST /variants/bulk-update` endpoint. The server
streams each change to Shopify’s Admin API using the private
`SHOPIFY_ACCESS_TOKEN`, then reports any failures back to the activity log. Keep
the proxy running before applying ring changes so the storefront is updated
alongside the local dashboard state.

### Live backups & restores

The **Create backup** button now requests the latest product data from Shopify
for the active workflow scope (bracelets, necklaces, rings, hand chains, sets,
or the global dashboard). The proxy snapshots every variant’s `price` and
`compare_at_price`, stores the payload locally with a timestamp, and refreshes
the in-app state so the preview reflects Shopify’s current numbers. Restoring a
backup diffs those saved values against Shopify and pushes the necessary
updates—every accessory page now behaves like the Rings page and writes directly
to Shopify instead of stopping at in-memory state. Start the proxy before
backing up or restoring so each operation can reach Shopify.

### Shopify product checklist

To ensure the pricing engine can recognise and update your variants, confirm
that each product in Shopify meets the following requirements:

1. **Collections / tagging**
   - Bracelets: tag the product with `brac` or set the product type to include
     “bracelet”.
   - Necklaces: tag with `nckl` or use a product type containing “necklace” or
     “collier”.
   - Rings: tag with `rng` or a product type containing “ring” or “bague”.
   - Hand chains: tag with `hchn` or a product type containing “hand chain”.
   - Sets: tag with `set`/`ensemble` or a product type containing “set” or
     “ensemble”.

2. **Variant metadata**
   - Variant IDs must be stable—updates are sent directly to each `variant.id`.
   - SKUs are optional and ignored by the matching algorithm.
   - Compare-at prices should be populated if you want the UI to render the
     before/after comparison; missing values default to the variant’s current
     `price`.

3. **Status**
   - Only `active` Shopify products are loaded into the dashboard. Archive or
     draft items are skipped automatically.

Review this checklist when introducing new SKUs to Shopify to guarantee the UI
generates previews, applies updates, and restores backups without manual
intervention.

### Shopify Metafield Format Requirements

Your Shopify products must have these metafield values configured:

**Chain Options** (for bracelets, necklaces, hand chains):
- `Forsat S`, `Forsat M`, `Forsat L`
- `Gourmette S`, `Gourmette M`
- `Chopard S`, `Chopard M`

**Chaine Size** (for necklaces):
- `41 cm`, `45 cm`, `50 cm`, `55 cm`, `60 cm`, `70 cm`, `80 cm`

**Ring Sizes**:
- `XL (60 - 65)`, `L (55 - 59)`, `S (50 - 54)`, `XS (46 - 49)`

**Band Type** (for rings):
- `Big`, `Light`, `Small`

The app automatically parses these formats to match against pricing data.

### Necklace variant enrichment

When the proxy fetches necklace products (tagged `nckl` or with a necklace
product type), it now cross-references the **Chain Options** and **Chaine Size**
metafields before data reaches the client. If both metafields are populated,
the proxy attaches the resolved chain type and size directly onto each variant
payload. Variants missing either metafield are flagged as incomplete so the UI
shows a red status badge and omits them from automatic updates. This keeps the
necklace preview in sync with Shopify while avoiding extra Admin API calls from
the browser.

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
