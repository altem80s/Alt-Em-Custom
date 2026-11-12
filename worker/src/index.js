import { PRODUCTS } from "../catalog.js";

const STRIPE_API = "https://api.stripe.com/v1";
const MAX_CART_LINES = 25;
const MAX_QUANTITY = 10;

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "https://altemcustom.com")
    .split(",").map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const origins = allowedOrigins(env);
  const chosenOrigin = origins.includes(origin) ? origin : (origins[0] || "https://altemcustom.com");
  return {
    "Access-Control-Allow-Origin": chosenOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Stripe-Signature",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(headers || {}) }
  });
}

function response(request, env, data, status) {
  return json(data, status, corsHeaders(request, env));
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/[<>]/g, "").slice(0, maxLength);
}

async function stripeRequest(env, path, options) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured on the store server.");
  const init = options || {};
  init.headers = {
    "Authorization": "Bearer " + env.STRIPE_SECRET_KEY,
    ...(init.headers || {})
  };
  const result = await fetch(STRIPE_API + path, init);
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const message = payload && payload.error && payload.error.message;
    throw new Error(message || "Stripe could not complete the request.");
  }
  return payload;
}

async function getVerifiedPrice(env, product) {
  if (!product || product.active !== true || !product.priceId || !String(product.priceId).startsWith("price_")) {
    return null;
  }
  const query = "?expand%5B%5D=product";
  const price = await stripeRequest(env, "/prices/" + encodeURIComponent(product.priceId) + query);
  const stripeProduct = typeof price.product === "object" ? price.product : null;
  if (!price.active || price.type !== "one_time" || !stripeProduct || !stripeProduct.active) return null;
  return price;
}

async function listProducts(env) {
  const items = await Promise.all(PRODUCTS.map(async (product) => {
    let price = null;
    if (product.active && product.priceId) {
      try { price = await getVerifiedPrice(env, product); } catch (_) { price = null; }
    }
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      kind: product.kind,
      available: Boolean(price),
      amount: price ? price.unit_amount : null,
      currency: price ? price.currency : null
    };
  }));
  return { products: items };
}

function siteUrl(env) {
  return (env.SITE_URL || "https://altemcustom.com").replace(/\/+$/, "");
}

async function createCheckout(request, env) {
  let body;
  try { body = await request.json(); } catch (_) {
    return response(request, env, { error: "Send a valid JSON cart." }, 400);
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_CART_LINES) {
    return response(request, env, { error: "Your cart is empty or contains too many items." }, 400);
  }

  const quantities = new Map();
  for (const line of body.items) {
    const id = cleanText(line && line.productId, 80);
    const quantity = Number(line && line.quantity);
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return response(request, env, { error: "One or more cart quantities are invalid." }, 400);
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  if ([...quantities.values()].some((quantity) => quantity > MAX_QUANTITY)) {
    return response(request, env, { error: "A product quantity exceeds the limit." }, 400);
  }

  const selected = [];
  for (const [id, quantity] of quantities.entries()) {
    const product = PRODUCTS.find((item) => item.id === id);
    if (!product) return response(request, env, { error: "A product in your cart could not be found." }, 400);
    const price = await getVerifiedPrice(env, product);
    if (!price) {
      return response(request, env, { error: product.name + " is not available for purchase yet." }, 409);
    }
    selected.push({ product, price, quantity });
  }

  const currencies = new Set(selected.map((item) => item.price.currency));
  if (currencies.size !== 1) {
    return response(request, env, { error: "All items in one order must use the same currency." }, 400);
  }

  const hasPhysical = selected.some((item) => item.product.kind === "physical");
  if (hasPhysical && !env.SHIPPING_RATE_ID) {
    return response(request, env, {
      error: "Shipping has not been configured yet. Please try again later."
    }, 503);
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", siteUrl(env) + "/success.html?session_id={CHECKOUT_SESSION_ID}");
  params.set("cancel_url", siteUrl(env) + "/shop.html?checkout=cancel");
  params.set("allow_promotion_codes", "true");
  params.set("billing_address_collection", "auto");
  params.set("client_reference_id", crypto.randomUUID());
  params.set("metadata[store]", "Alt Em Custom");

  selected.forEach((item, index) => {
    params.set("line_items[" + index + "][price]", item.product.priceId);
    params.set("line_items[" + index + "][quantity]", String(item.quantity));
  });

  if (hasPhysical) {
    const countries = (env.SHIPPING_COUNTRIES || "US").split(",").map((value) => value.trim()).filter(Boolean);
    countries.forEach((country, index) => {
      params.set("shipping_address_collection[allowed_countries][" + index + "]", country);
    });
    params.set("shipping_options[0][shipping_rate]", env.SHIPPING_RATE_ID);
  }

  if (env.ENABLE_AUTOMATIC_TAX === "true") {
    params.set("automatic_tax[enabled]", "true");
  }

  try {
    const session = await stripeRequest(env, "/checkout/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    return response(request, env, { url: session.url }, 200);
  } catch (error) {
    return response(request, env, {
      error: "Stripe could not start checkout. " + cleanText(error.message, 220)
    }, 502);
  }
}

function validSessionId(value) {
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(String(value || ""));
}

async function retrieveSession(env, sessionId) {
  const query = "?expand%5B%5D=line_items.data.price.product";
  return stripeRequest(env, "/checkout/sessions/" + encodeURIComponent(sessionId) + query);
}

async function sessionLineItems(env, session) {
  if (session.line_items && Array.isArray(session.line_items.data)) return session.line_items.data;
  const result = await stripeRequest(env, "/checkout/sessions/" + encodeURIComponent(session.id) + "/line_items?limit=100");
  return result.data || [];
}

async function getOrder(request, env, url) {
  const sessionId = url.searchParams.get("session_id");
  if (!validSessionId(sessionId)) return response(request, env, { error: "A valid checkout session is required." }, 400);

  try {
    const session = await retrieveSession(env, sessionId);
    if (session.payment_status !== "paid") {
      return response(request, env, {
        paid: false,
        payment_status: session.payment_status || "unpaid"
      }, 200);
    }

    const lineItems = await sessionLineItems(env, session);
    const items = lineItems.map((line) => {
      const priceId = typeof line.price === "object" ? line.price.id : line.price;
      const product = PRODUCTS.find((item) => item.priceId === priceId);
      if (!product) return null;
      return {
        id: product.id,
        name: product.name,
        quantity: line.quantity || 1,
        kind: product.kind,
        downloadAvailable: product.kind === "digital" && Boolean(product.downloadKey)
      };
    }).filter(Boolean);

    return response(request, env, {
      paid: true,
      payment_status: session.payment_status,
      customer_email: session.customer_details && session.customer_details.email || null,
      amount_total: session.amount_total,
      currency: session.currency,
      items
    }, 200);
  } catch (error) {
    return response(request, env, { error: "We could not verify this order with Stripe." }, 502);
  }
}

async function downloadProduct(request, env, url) {
  const sessionId = url.searchParams.get("session_id");
  const productId = cleanText(url.searchParams.get("product_id"), 80);
  if (!validSessionId(sessionId) || !productId) {
    return new Response("A valid paid order is required.", { status: 400 });
  }

  const product = PRODUCTS.find((item) => item.id === productId);
  if (!product || product.kind !== "digital" || !product.priceId || !product.downloadKey) {
    return new Response("This download is not configured.", { status: 404 });
  }
  if (!env.PATTERN_FILES) return new Response("Digital file storage is not configured.", { status: 503 });

  try {
    const session = await retrieveSession(env, sessionId);
    if (session.payment_status !== "paid") return new Response("Payment has not been completed.", { status: 403 });

    const lines = await sessionLineItems(env, session);
    const purchased = lines.some((line) => {
      const priceId = typeof line.price === "object" ? line.price.id : line.price;
      return priceId === product.priceId;
    });
    if (!purchased) return new Response("This item is not part of the paid order.", { status: 403 });

    const object = await env.PATTERN_FILES.get(product.downloadKey);
    if (!object) return new Response("The pattern file has not been uploaded yet.", { status: 404 });

    return new Response(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"" + product.id + ".pdf\"",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (_) {
    return new Response("We could not verify this download. Please contact Alt Em Custom.", { status: 502 });
  }
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find((part) => part[0] === "t");
  const signatures = parts.filter((part) => part[0] === "v1").map((part) => part[1]);
  if (!timestamp || !signatures.length) return false;
  const seconds = Number(timestamp[1]);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp[1] + "." + rawBody)
  );
  const expected = bytesToHex(signed);
  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;
    let mismatch = 0;
    for (let index = 0; index < expected.length; index += 1) {
      mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
    }
    return mismatch === 0;
  });
}

async function stripeWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get("Stripe-Signature");
  const valid = await verifyWebhookSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid Stripe signature.", { status: 400 });

  let event;
  try { event = JSON.parse(rawBody); } catch (_) {
    return new Response("Invalid event body.", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data && event.data.object;
    if (session && session.id && session.payment_status === "paid" && env.ORDERS) {
      const record = {
        session_id: session.id,
        payment_status: "paid",
        amount_total: session.amount_total || 0,
        currency: session.currency || "usd",
        stripe_event_id: event.id,
        created: event.created || Math.floor(Date.now() / 1000)
      };
      await env.ORDERS.put("order:" + session.id, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 });
      await env.ORDERS.put("event:" + event.id, "received", { expirationTtl: 60 * 60 * 24 * 180 });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/api/stripe-webhook" && request.method === "POST") {
      return stripeWebhook(request, env);
    }

    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (path === "/api/health" && request.method === "GET") {
      return response(request, env, { ok: true, service: "Alt Em Custom store API" }, 200);
    }
    if (path === "/api/products" && request.method === "GET") {
      try { return response(request, env, await listProducts(env), 200); }
      catch (_) { return response(request, env, { error: "The store catalogue is temporarily unavailable." }, 503); }
    }
    if (path === "/api/checkout" && request.method === "POST") {
      if (Number(request.headers.get("Content-Length") || 0) > 12000) {
        return response(request, env, { error: "Cart request is too large." }, 413);
      }
      try {
        return await createCheckout(request, env);
      } catch (_) {
        return response(request, env, { error: "Checkout is temporarily unavailable. Please try again later." }, 503);
      }
    }
    if (path === "/api/order" && request.method === "GET") {
      return getOrder(request, env, url);
    }
    if (path === "/api/download" && request.method === "GET") {
      return downloadProduct(request, env, url);
    }
    return response(request, env, { error: "Not found." }, 404);
  }
};
