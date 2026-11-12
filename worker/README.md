# Alt Em Custom Stripe store backend

This repository is a static GitHub Pages site. The payment backend is a Cloudflare Worker so the Stripe secret key never goes into browser JavaScript or GitHub.

## What's in this folder

- `src/index.js`: Stripe Checkout API, paid-order verification, webhook signature verification, and protected PDF downloads.
- `catalog.js`: server-side allowlist of products. Every product stays unavailable until a real Stripe one-time Price ID is added.
- `wrangler.jsonc`: Worker custom domain, KV order log, and R2 private pattern-file bucket.

## Important: not live for sales yet

The connected Stripe live account currently has no active Products or Prices. The six current Shop listings are draft entries in `catalog.js` with `active: false` and no `priceId`. That is intentional: the browser cannot choose or change prices, and no checkout can be opened until a product is configured with a real Stripe Price ID.

Before changing those entries, confirm the actual products, prices, tax approach, shipping destinations, and shipping rate. Do not guess these values.

## Deploy the Worker

1. Make sure the Cloudflare account has the `altemcustom.com` zone active and that `api.altemcustom.com` is not already occupied by a conflicting DNS record.
2. Install Node.js, then from this folder run:

   ```bash
   npx wrangler login
   npx wrangler r2 bucket create alt-em-pattern-files
   npx wrangler secret put STRIPE_SECRET_KEY
   ```

   Paste the live secret key from Stripe Dashboard when prompted. Never commit it or paste it into a website file.

3. Deploy the Worker:

   ```bash
   npx wrangler deploy
   ```

   Wrangler creates the `api.altemcustom.com` Custom Domain and the configured KV namespace. Cloudflare documents Custom Domains and encrypted Worker secrets here:
   - https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
   - https://developers.cloudflare.com/workers/configuration/secrets/

4. In Stripe Dashboard, create a webhook endpoint at:

   `https://api.altemcustom.com/api/stripe-webhook`

   Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`

   Copy the endpoint signing secret (starts with `whsec_`) and run:

   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   npx wrangler deploy
   ```

5. Check the API:

   `https://api.altemcustom.com/api/health`

## Configure actual products

For each product you are ready to sell:

1. Create the Product and a one-time Price in Stripe Dashboard (live mode only once the product/price has been confirmed).
2. Copy the Price ID (starts with `price_`).
3. In `catalog.js`, set the correct `priceId` and set `active: true`.
4. For a digital product, set `kind: "digital"` and set `downloadKey` to a private object key, for example `patterns/my-shirt-pattern.pdf`.
5. For physical products, create a shipping rate in Stripe Dashboard, then set `SHIPPING_RATE_ID` in Wrangler vars. The default allowed shipping country is US; change `SHIPPING_COUNTRIES` before selling elsewhere.
6. Upload the matching PDF into the private R2 bucket under the exact key used in `downloadKey`. Do not put paid PDFs in the public GitHub Pages repository.
7. Deploy again with `npx wrangler deploy`.

The site reads live availability and prices from the Worker. Checkout line items always use the server-side Stripe Price IDs, not prices sent from the browser.

## Sales tax

Automatic tax is off by default. Before turning it on, configure Stripe Tax and registrations for the places where the business is required to collect tax, and set `ENABLE_AUTOMATIC_TAX` to `true`. Product tax codes and price tax behavior may also need configuration. Consult https://docs.stripe.com/tax/set-up.

## Security and fulfillment notes

- Stripe live secret and webhook signing secret are Cloudflare Worker secrets.
- Webhook signatures are checked against the unmodified request body and timestamp.
- Download requests retrieve the Checkout Session from Stripe, require `payment_status=paid`, and confirm the purchased Stripe Price ID before reading from private R2.
- The order KV stores a minimal payment record for 180 days; it does not store addresses or full card details.
- Customers receive the confirmation/download page after checkout. Automated delivery emails are not configured yet; that requires an email provider and sender-domain setup.
