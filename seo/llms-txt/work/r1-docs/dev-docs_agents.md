---
title: Agentic commerce
description: >-
  Build AI agents that authenticate with Shopify, search the Catalog, build
  carts and checkouts, and monitor orders using the Universal Commerce Protocol
  (UCP).
source_url:
  html: 'https://shopify.dev/docs/agents'
  md: 'https://shopify.dev/docs/agents.md'
---

# Build commerce agents with UCP

Build unified agentic experiences that securely act on behalf of buyers with the [Universal Commerce Protocol (UCP)](https://ucp.dev) and Shopify's UCP-compliant MCP servers.

[Start building\
\
](https://shopify.dev/docs/agents/get-started/quickstart)

[Install the toolkit, then walk the full flow from discovery to order tracking.](https://shopify.dev/docs/agents/get-started/quickstart)

## Get started

Install the UCP CLI and [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) plugin for your supported AI tool. Built for agent workflows, the CLI provides structured commands to search the Catalog, build carts, create checkouts, hand off buyers, and track orders. The toolkit's `ucp` skill helps agents apply UCP best practices against each merchant's live schema.

Before you install, make sure you have Node.js 18 or higher. The toolkit is supported on any agent that supports the skills format.

#### Claude Code

## Terminal: Install the UCP CLI

```terminal
npm install -g @shopify/ucp-cli
```

## Terminal: Install the Shopify plugin

```terminal
claude plugin install shopify-ai-toolkit@claude-plugins-official
```

#### Codex

## Terminal: Install the UCP CLI

```terminal
npm install -g @shopify/ucp-cli
```

## Terminal: Install the Shopify plugin

```terminal
codex plugin add shopify@openai-curated
```

#### Antigravity CLI

## Terminal: Install the UCP CLI

```terminal
npm install -g @shopify/ucp-cli
```

## Terminal: Install the Shopify plugin

```terminal
agy plugin install https://github.com/Shopify/shopify-ai-toolkit
```

#### Cursor

## Terminal: Install the UCP CLI

```terminal
npm install -g @shopify/ucp-cli
```

## Cursor Chat:

```terminal
/add-plugin shopify
```

#### VS Code

## Terminal: Install the UCP CLI

```terminal
npm install -g @shopify/ucp-cli
```

## Command Palette > Chat: Install Plugin From Source

https://github.com/Shopify/shopify-ai-toolkit

***

## Access universal cart

One Cart, every brand. The Universal Cart API lets AI agents collect items from any merchant, on or off Shopify, into a single, unified cart, all via UCP.

[Request access\
\
](https://docs.google.com/forms/d/e/1FAIpQLSd0p9DP-7ANuhqGoNePjczPhSWmTBwAiFbfIKgs2G95MC9YAQ/viewform?usp=preview)

[Join the early access waitlist.](https://docs.google.com/forms/d/e/1FAIpQLSd0p9DP-7ANuhqGoNePjczPhSWmTBwAiFbfIKgs2G95MC9YAQ/viewform?usp=preview)

![Universal Cart.](https://shopify.dev/assets/assets/images/agents/universalcart-light-CFDlderG.png)

***

## Understand how Shopify does UCP

Shopify's MCP tools implement UCP at every step of the buyer journey:

* **Negotiate and authenticate**: Identify your agent and get the right access tier.
* **Discover products**: Search across hundreds of millions of Shopify listings.
* **Carts and checkout**: Build carts, convert them to checkouts, and hand off to the merchant for payment.
* **Monitor orders**: Receive order webhooks and fetch fresh order state on demand.

![The four-stage agentic commerce buyer journey: discovery, cart, checkout, and orders, connected by dashed arrows.](https://shopify.dev/assets/assets/images/agents/ucp-flow-4-light-C9RMxm5d.png)

***

## ![Step 1](https://shopify.dev/assets/assets/images/icons/32/number-1-DG-dFgp6.png) Negotiate and authenticate

Define a profile so Shopify can verify your agent and apply the right rate limits and tool access. Higher trust tiers unlock broader access, including direct checkout completion. Profiles are hosted at a well-known URL and referenced on every UCP request.

[About profiles\
\
](https://shopify.dev/docs/agents/profiles)

[Host a UCP profile for capability negotiation and signed-request verification.](https://shopify.dev/docs/agents/profiles)

[Auth and rate limiting\
\
](https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting)

[Trust tiers, capability matrix, and rate limits per tier.](https://shopify.dev/docs/agents/profiles/auth-and-rate-limiting)

![Diagram showing an agent presenting its profile to Shopify, with a key icon representing authenticated capability negotiation.](https://shopify.dev/assets/assets/images/agents/agents-auth-light-BQxS1ihn.png)

***

## ![Step 2](https://shopify.dev/assets/assets/images/icons/32/number-2-KzqDfbX_.png) Discover products

Query products across all Shopify merchants with the Global Catalog, or scope results to a single merchant with a Storefront Catalog. When buyers pick a product, fetch the variant details you need to build a cart or hand off to a checkout permalink.

[Global Catalog\
\
](https://shopify.dev/docs/agents/catalog/global-catalog)

[Search products across every Shopify merchant from a single endpoint.](https://shopify.dev/docs/agents/catalog/global-catalog)

[Storefront Catalog\
\
](https://shopify.dev/docs/agents/catalog/storefront-catalog)

[Scope discovery to a single merchant's storefront.](https://shopify.dev/docs/agents/catalog/storefront-catalog)

![Search results across multiple Shopify merchants, with product titles, images, and variant details surfaced for an agent to act on.](https://shopify.dev/assets/assets/images/agents/catalog-light-wSL3czp-.png)

***

## ![Step 3](https://shopify.dev/assets/assets/images/icons/32/number-3-69W0NVcD.png) Build carts and convert to checkout

Build carts as buyers iterate. Add line items, apply localization, and estimate totals across multiple turns of conversation. When buyers are ready, convert the cart into a checkout and refer them to the merchant storefront to complete payment. Trusted agents can complete checkouts directly.

[Cart MCP\
\
](https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp)

[Build and iterate on carts with line items, localization, and buyer context.](https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp)

[Checkout MCP\
\
](https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp)

[Convert carts into checkouts and complete purchases for trusted agents.](https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp)

![A checkout session with line items, fulfillment options, and a continue link that hands the buyer off to the merchant storefront.](https://shopify.dev/assets/assets/images/agents/zoomedcheckoutlight-6vMgJOBz.png)

***

## ![Step 4](https://shopify.dev/assets/assets/images/icons/32/number-4-DqGMO7Cl.png) Monitor orders

After checkout, monitor order lifecycle changes (fulfillment events, refunds, returns, exchanges, and cancellations) with UCP-shaped order webhooks. Fetch fresh order state on demand with the `get_order` MCP tool when the buyer asks "Where's my order?" or when reconciling a missed webhook.

[Order MCP\
\
](https://shopify.dev/docs/agents/orders/order-mcp)

[Fetch fresh order state on demand with the `get_order` tool.](https://shopify.dev/docs/agents/orders/order-mcp)

[Order webhooks\
\
](https://shopify.dev/docs/agents/orders/order-webhooks)

[Subscribe to lifecycle events for fulfillment, returns, refunds, and edits.](https://shopify.dev/docs/agents/orders/order-webhooks)

![An order detail view showing fulfillment status, line items, and post-purchase adjustments returned by get\_order and order webhooks.](https://shopify.dev/assets/assets/images/agents/order-light-DsWFrEev.png)

***
