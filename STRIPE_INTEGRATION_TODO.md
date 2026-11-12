# Stripe integration TODO

## Values to Replace

No sample-only Checkout Session values are currently placeholders:

- `mode` is already set to `payment` for one-time digital-product purchases.
- `success_url` is an existing site URL: `https://altemcustom.com/success.html?session_id={CHECKOUT_SESSION_ID}`.
- `cancel_url` is an existing site URL: `https://altemcustom.com/shop.html?checkout=cancel`.
- `line_items` are built from the server-side product catalogue and verified Stripe Price IDs; no sample `price_...` value is hardcoded.

The first digital product still needs a real Stripe Product and one-time Price. Add its Price ID and activate the corresponding entry in [worker/catalog.js](worker/catalog.js) only after confirming the product and price in Stripe.

## Configured Parameters

**File:** [worker/src/index.js](worker/src/index.js)

| Parameter | Value |
|---|---|
| `ui_mode` | `hosted_page` |
| `mode` | `payment` |
| `billing_address_collection` | `auto` |
| `phone_number_collection[enabled]` | `false` |
| `automatic_tax[enabled]` | `false` |
| `allow_promotion_codes` | `false` |
| `submit_type` | `auto` |
| `integration_identifier` | `hosted_web_0001` |
| `origin_context` | `web` |

`success_url`, `cancel_url`, and the server-generated `line_items` were preserved because they already contain real application values. `payment_method_collection` is intentionally omitted because this integration uses one-time payments, not subscriptions.

## Setup and Next Steps

1. In Stripe Dashboard, finish the account review before attempting live charges.
2. Create the first digital sewing-pattern Product and a one-time Price in Stripe.
3. In [worker/catalog.js](worker/catalog.js), configure that product with its verified Price ID, set `kind: "digital"`, set `active: true`, and set `downloadKey` to the private R2 object key for its PDF.
4. Upload the PDF to the private Cloudflare R2 bucket using that exact object key. Do not put the paid PDF in the public GitHub Pages repository.
5. Confirm the Cloudflare Worker secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are configured, and that the Worker and its KV/R2 bindings are deployed.
6. Test the complete flow in Stripe test mode first, including a successful payment, a cancelled checkout, and a protected PDF download. Use Stripe's test card `4242 4242 4242 4242`, any future expiry date, and any CVC.
7. Switch to live mode only after Stripe approves the account and the test flow is verified. Create the live Product and Price separately and use the live Price ID in the live deployment.

## How It Works

The browser sends product IDs and quantities to the existing Cloudflare Worker endpoint. The Worker checks the server-side catalogue, retrieves and verifies each Stripe Price, and creates a hosted Checkout Session using only those server-side Price IDs. After payment, the customer returns to `success.html`; the backend verifies the Checkout Session before granting access to the private PDF.

## SDK / API Version Note

This project calls Stripe's REST API directly from the Cloudflare Worker rather than using an installed Stripe SDK package. Therefore, there is no SDK package version to inspect for the `ui_mode` versioning rule. The configured value follows the supplied Checkout Studio setting, `hosted_page`.

## Remaining Operational Notes

- Automatic tax is explicitly disabled, as configured in Checkout Studio. Confirm your sales-tax obligations independently before selling.
- Promotion codes are disabled.
- This is a one-time payment flow. Do not enable subscription-only `payment_method_collection`.
- Automated email delivery is not configured; the current purchase flow provides the protected download on the confirmation page.

## Resources

- [Stripe Checkout documentation](https://docs.stripe.com/checkout)
- [Stripe API keys best practices](https://docs.stripe.com/keys-best-practices)
- [Stripe testing](https://docs.stripe.com/testing)
- [Stripe support](https://support.stripe.com)
- [Stripe MCP documentation](https://docs.stripe.com/mcp)
