(() => {
  "use strict";

  const API = "https://api.altemcustom.com/api";
  const CART_KEY = "alt-em-cart-v1";
  const DRAFT_PRODUCTS = [
    { id: "studded-leather-moto-vest", name: "Studded leather moto vest", description: "Black leather, silver studs, fully lined.", kind: "physical", available: false },
    { id: "lace-babydoll-corset-top", name: "Lace babydoll corset top", description: "Boned bodice with a black lace overlay.", kind: "physical", available: false },
    { id: "polka-dot-wiggle-skirt", name: "Polka dot wiggle skirt", description: "High waist, fitted through the hip, with a back kick pleat.", kind: "physical", available: false },
    { id: "glam-rock-flare-pants", name: "Glam rock flare pants", description: "Stretch satin with a bell hem and a high rise.", kind: "physical", available: false },
    { id: "satin-bomber-jacket", name: "Satin bomber jacket", description: "Quilted lining, ribbed cuffs, and a bold back panel.", kind: "physical", available: false },
    { id: "fringe-leather-bolero", name: "Fringe leather bolero", description: "Cropped, with long swinging fringe.", kind: "physical", available: false }
  ];
  let products = DRAFT_PRODUCTS;
  let cart = readCart();

  function readCart() {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (_) {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function formatMoney(amount, currency) {
    if (typeof amount !== "number" || !currency) return "";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase()
      }).format(amount / 100);
    } catch (_) {
      return (amount / 100).toFixed(2) + " " + currency.toUpperCase();
    }
  }

  async function api(path, options) {
    const response = await fetch(API + path, {
      cache: "no-store",
      ...(options || {}),
      headers: {
        ...(options && options.headers ? options.headers : {}),
        ...(options && options.body ? { "Content-Type": "application/json" } : {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "The store service is unavailable.");
    return data;
  }

  function renderShop() {
    const grid = document.querySelector("#product-grid");
    const notice = document.querySelector("[data-store-notice]");
    if (!grid) return;

    const kindFilter = grid.getAttribute("data-product-kind") || "all";
    const visibleProducts = products.filter((product) => kindFilter === "all" || product.kind === kindFilter);
    const availableCount = visibleProducts.filter((product) => product.available).length;
    grid.innerHTML = visibleProducts.map((product) => {
      const price = product.available ? formatMoney(product.amount, product.currency) : "";
      const action = product.available
        ? '<button class="btn store-add" type="button" data-add-to-cart="' + escapeHtml(product.id) + '">Add to bag</button>'
        : '<span class="coming-soon store-coming">Coming soon</span><button class="btn alt store-add" type="button" disabled>Not available yet</button>';
      return '<article class="card store-card">' +
        '<div class="product-placeholder" aria-hidden="true">Alt Em Custom</div>' +
        '<div class="card-body">' +
          '<p class="store-kind">' + (product.kind === "digital" ? "Digital pattern" : "Made to order") + '</p>' +
          '<h3>' + escapeHtml(product.name) + '</h3>' +
          '<p>' + escapeHtml(product.description) + '</p>' +
          (price ? '<span class="price">' + escapeHtml(price) + '</span>' : '<span class="price store-price-pending">Price coming soon</span>') +
          action +
        '</div>' +
      '</article>';
    }).join("");

    if (!visibleProducts.length) {
      grid.innerHTML = kindFilter === "digital"
        ? '<p class="store-empty">No downloadable patterns are published yet. New patterns will appear here when they are ready.</p>'
        : '<p class="store-empty">The shop catalogue is being prepared. Please check back soon.</p>';
    }
    if (notice) {
      notice.textContent = availableCount
        ? ""
        : "The catalogue is being set up. Products will become available when their Stripe prices and shipping settings are ready.";
      notice.hidden = availableCount > 0;
    }
  }

  function currentCartItems() {
    return Object.entries(cart).map(([id, quantity]) => ({
      product: products.find((product) => product.id === id),
      quantity: Number(quantity)
    })).filter((entry) => entry.product && entry.product.available &&
      Number.isInteger(entry.quantity) && entry.quantity > 0);
  }

  function renderCart() {
    const container = document.querySelector("[data-cart-items]");
    const totalNode = document.querySelector("[data-cart-total]");
    const checkout = document.querySelector("[data-checkout]");
    const countNode = document.querySelector("[data-cart-count]");
    const entries = currentCartItems();
    const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const total = entries.reduce((sum, entry) => sum + entry.product.amount * entry.quantity, 0);

    if (countNode) {
      countNode.textContent = String(count);
      countNode.hidden = count === 0;
    }
    if (container) {
      container.innerHTML = entries.length ? entries.map((entry) => {
        const product = entry.product;
        return '<div class="cart-item">' +
          '<div class="cart-item-copy"><strong>' + escapeHtml(product.name) + '</strong>' +
          '<span>' + escapeHtml(formatMoney(product.amount, product.currency)) + ' each</span></div>' +
          '<div class="cart-item-controls">' +
            '<label class="visually-hidden" for="qty-' + escapeHtml(product.id) + '">Quantity for ' + escapeHtml(product.name) + '</label>' +
            '<input id="qty-' + escapeHtml(product.id) + '" type="number" min="1" max="10" step="1" value="' + entry.quantity + '" data-quantity="' + escapeHtml(product.id) + '">' +
            '<button class="cart-remove" type="button" data-remove="' + escapeHtml(product.id) + '">Remove</button>' +
          '</div></div>';
      }).join("") : '<p class="cart-empty">Your bag is empty.</p>';
    }
    if (totalNode) totalNode.textContent = formatMoney(total, entries[0] ? entries[0].product.currency : "USD") || "$0.00";
    if (checkout) checkout.disabled = entries.length === 0;
  }

  function openCart() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (!drawer || !overlay) return;
    drawer.hidden = false;
    overlay.hidden = false;
    document.body.classList.add("cart-is-open");
    const close = drawer.querySelector("[data-cart-close]");
    if (close) close.focus();
  }

  function closeCart() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const overlay = document.querySelector("[data-cart-overlay]");
    if (drawer) drawer.hidden = true;
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("cart-is-open");
  }

  function feedback(message, isError) {
    const node = document.querySelector("[data-cart-feedback]");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  async function beginCheckout() {
    const checkout = document.querySelector("[data-checkout]");
    const items = currentCartItems();
    if (!items.length) return;
    if (checkout) checkout.disabled = true;
    feedback("Opening secure checkout…", false);

    try {
      const result = await api("/checkout", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((entry) => ({
            productId: entry.product.id,
            quantity: entry.quantity
          }))
        })
      });
      if (!result.url || !/^https:\/\/checkout\.stripe\.com\//.test(result.url)) {
        throw new Error("Stripe did not return a valid checkout link.");
      }
      window.location.assign(result.url);
    } catch (error) {
      feedback(error.message || "Checkout could not be started. Please try again.", true);
      if (checkout) checkout.disabled = false;
    }
  }

  async function loadOrder() {
    const status = document.querySelector("[data-order-status]");
    const details = document.querySelector("[data-order-details]");
    if (!status || !details) return;
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) {
      status.textContent = "We could not find a checkout session for this page.";
      return;
    }

    status.textContent = "Verifying your payment with Stripe…";
    try {
      const order = await api("/order?session_id=" + encodeURIComponent(sessionId));
      if (!order.paid) {
        status.textContent = "Your payment is not confirmed yet. Refresh this page in a moment. If you were charged, contact us before trying again.";
        return;
      }

      localStorage.removeItem(CART_KEY);
      cart = {};
      renderCart();
      status.textContent = "Payment received. Thank you for supporting Alt Em Custom.";
      const total = formatMoney(order.amount_total, order.currency);
      details.innerHTML =
        '<p class="order-receipt">' +
          (order.customer_email ? 'Receipt email: <strong>' + escapeHtml(order.customer_email) + '</strong><br>' : '') +
          'Order total: <strong>' + escapeHtml(total) + '</strong>' +
        '</p>' +
        '<div class="order-items">' + (order.items || []).map((item) =>
          '<div class="order-line"><span>' + escapeHtml(item.name) + ' × ' + item.quantity + '</span>' +
          (item.downloadAvailable
            ? '<a class="btn" href="' + API + '/download?session_id=' + encodeURIComponent(sessionId) + '&product_id=' + encodeURIComponent(item.id) + '">Download PDF</a>'
            : '<span>We will prepare your order.</span>') +
          '</div>'
        ).join("") + '</div>';
      if (!order.items || !order.items.length) {
        details.innerHTML += '<p>Your payment was received. Contact us with your receipt if you need help with your order.</p>';
      }
    } catch (_) {
      status.textContent = "We could not verify your order just now. Please refresh this page. Your payment status can also be checked in your Stripe receipt.";
    }
  }

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-cart-open]");
    if (openButton) {
      event.preventDefault();
      openCart();
      return;
    }

    if (event.target.closest("[data-cart-close]") || event.target.matches("[data-cart-overlay]")) {
      closeCart();
      return;
    }

    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton) {
      const id = addButton.getAttribute("data-add-to-cart");
      const product = products.find((item) => item.id === id && item.available);
      if (!product) return;
      cart[id] = Math.min(10, Number(cart[id] || 0) + 1);
      saveCart();
      renderCart();
      feedback(product.name + " added to your bag.", false);
      openCart();
      return;
    }

    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      delete cart[removeButton.getAttribute("data-remove")];
      saveCart();
      renderCart();
      return;
    }

    if (event.target.closest("[data-checkout]")) {
      beginCheckout();
    }
  });

  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-quantity]");
    if (!input) return;
    const id = input.getAttribute("data-quantity");
    const quantity = Number(input.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      input.value = String(cart[id] || 1);
      return;
    }
    cart[id] = quantity;
    saveCart();
    renderCart();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCart();
  });

  async function init() {
    const cancelMessage = new URLSearchParams(window.location.search).get("checkout") === "cancel";
    if (cancelMessage) {
      const notice = document.querySelector("[data-store-notice]");
      if (notice) {
        notice.textContent = "Checkout was cancelled. Your bag is still saved if you want to try again.";
        notice.hidden = false;
      }
    }
    renderCart();
    try {
      const result = await api("/products");
      products = Array.isArray(result.products) ? result.products : [];
      renderShop();
      renderCart();
    } catch (_) {
      products = DRAFT_PRODUCTS;
      renderShop();
      renderCart();
      const notice = document.querySelector("[data-store-notice]");
      if (notice) {
        notice.textContent = "The secure shop service is waiting for its Cloudflare Worker setup. Products will be purchasable after live Stripe prices and shipping are configured.";
        notice.hidden = false;
      }
    }
    if (document.querySelector("[data-success-page]")) loadOrder();
  }

  init();
})();
