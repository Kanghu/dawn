---
title: Agent profiles and UCP negotiation
description: >-
  Understand how platform agent profiles drive UCP discovery and capability
  negotiation with Shopify, then use hosted JSON fixtures to test valid paths,
  failures, and edge cases.
source_url:
  html: 'https://shopify.dev/docs/agents/profiles'
  md: 'https://shopify.dev/docs/agents/profiles.md'
---

# Agent profiles and UCP negotiation

In the [Universal Commerce Protocol (UCP)](https://ucp.dev/documentation/core-concepts/), a platform profile is a JSON document that describes the protocol version and capabilities the platform supports.

When your agents call UCP-shaped MCP tools, Shopify acts as the business in the negotiation. Shopify uses your profile to learn what your agent declares, intersect it with what the shop supports, and settle on a single negotiated set for the session.

This page explains this flow at a high level, and points to hosted agent profile fixtures you can reference from `meta.ucp-agent.profile` to use and test UCP.

For more detail, see the [UCP specification](https://ucp.dev/2026-08-25/specification/overview/).

***

## How it works

Negotiation for UCP involves two profiles:

* **Business profile:** Published by the merchant or platform operating the commerce API, typically at `/.well-known/ucp` on the business origin. On Shopify, this exists at the merchant storefront (`{shop}.myshopify.com/.well-known/ucp`). It describes that party’s protocol version, services, capabilities, payment handlers, and signing keys.
* **Platform profile:** Published at an HTTPS URL you host, it describes your agent’s declared protocol version and capabilities. You include this URL on every relevant request so the business can fetch, potentially cache, and negotiate.

Negotiation is server-selects. The business computes the intersection of its capabilities with the platform’s and chooses the active set, including which extension capabilities apply (for example, fulfillment or discount layered on checkout). Extensions that depend on a parent capability are pruned if that parent does not end up in the intersection.

Negotiation follows this sequence:

1. Your request includes the platform profile URL (see [Usage](#usage)).
2. Shopify (the business) fetches and validates the profile.
3. Protocol version alignment is checked against what the shop supports.
4. Capability intersection runs; matching capability names, compatible capability versions, then dependency pruning for extensions.
5. Responses include negotiated UCP metadata (including active capabilities) where applicable.

If the profile cannot be loaded, is invalid, or yields no compatible capabilities, you get an error path instead of a successful negotiation. See [Invalid profiles](#invalid-profiles) for more details.

***

## Usage

Include the agent profile URI in the `meta.ucp-agent.profile` field of your MCP request:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "create_checkout",
    "arguments": {
      "meta": {
        "ucp-agent": {
          "profile": "https://shopify.dev/ucp/agent-profiles/2026-08-25/valid-with-capabilities.json"
        }
      },
      "input": {
        "lines": []
      }
    }
  }
}
```

This profile triggers UCP discovery: profile fetch, validation, version negotiation, and caching.

***

## Valid profiles

These fixtures are profiles Shopify can load and negotiate against successfully for different UCP versions.

* [With capabilities](#with-capabilities)
* [Only checkout capabilities](#only-checkout-capabilities)

### With capabilities

A platform (an agent) declares checkout with multiple extensions, then the business intersects with its own capabilities. Matching ones are kept, orphaned extensions are pruned.

The examples below will result in a full capability set negotiated successfully. You can use them to test that capability intersection works end-to-end, where agent and business agree on a complete set.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/valid-with-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/valid-with-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-08-25",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-08-25/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-08-25"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-08-25",
          "extends": [
            "dev.ucp.shopping.checkout",
            "dev.ucp.shopping.cart"
          ]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-08-25",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-08-25",
          "extends": [
            "dev.ucp.shopping.checkout",
            "dev.ucp.shopping.cart"
          ]
        }
      ],
      "dev.ucp.shopping.cart": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/cart",
          "schema": "https://ucp.dev/2026-08-25/schemas/shopping/cart.json"
        }
      ],
      "dev.ucp.shopping.order": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/order",
          "schema": "https://ucp.dev/2026-08-25/schemas/shopping/order.json"
        }
      ],
      "dev.ucp.shopping.catalog.search": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/catalog/search",
          "schema": "https://ucp.dev/2026-08-25/schemas/shopping/catalog_search.json"
        }
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/catalog/lookup",
          "schema": "https://ucp.dev/2026-08-25/schemas/shopping/catalog_lookup.json"
        }
      ],
      "dev.shopify.catalog": [
        {
          "version": "2026-08-25",
          "spec": "https://shopify.dev/docs/agents/catalog/storefront-catalog",
          "schema": "https://shopify.dev/ucp/schemas/2026-08-25/shopify_catalog.json",
          "extends": [
            "dev.ucp.shopping.catalog.lookup",
            "dev.ucp.shopping.catalog.search"
          ]
        }
      ],
      "dev.shopify.catalog.global": [
        {
          "version": "2026-08-25",
          "spec": "https://shopify.dev/docs/agents/catalog/global-catalog",
          "schema": "https://shopify.dev/ucp/schemas/2026-08-25/shopify_catalog_global.json",
          "extends": [
            "dev.ucp.shopping.catalog.lookup",
            "dev.ucp.shopping.catalog.search"
          ]
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-04-08",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-04-08"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-04-08",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-04-08",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-04-08",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.cart": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/cart",
          "schema": "https://ucp.dev/2026-04-08/schemas/shopping/cart.json"
        }
      ],
      "dev.ucp.shopping.order": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/order",
          "schema": "https://ucp.dev/2026-04-08/schemas/shopping/order.json"
        }
      ],
      "dev.ucp.shopping.catalog.search": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/catalog/search",
          "schema": "https://ucp.dev/2026-04-08/schemas/shopping/catalog_search.json"
        }
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/catalog/lookup",
          "schema": "https://ucp.dev/2026-04-08/schemas/shopping/catalog_lookup.json"
        }
      ],
      "dev.shopify.catalog": [
        {
          "version": "2026-04-08",
          "spec": "https://shopify.dev/docs/agents/catalog/storefront-catalog",
          "schema": "https://shopify.dev/ucp/schemas/2026-04-08/shopify_catalog.json",
          "extends": ["dev.ucp.shopping.catalog.lookup", "dev.ucp.shopping.catalog.search"]
        }
      ],
      "dev.shopify.catalog.global": [
        {
          "version": "2026-04-08",
          "spec": "https://shopify.dev/docs/agents/catalog/global-catalog",
          "schema": "https://shopify.dev/ucp/schemas/2026-04-08/shopify_catalog_global.json",
          "extends": ["dev.ucp.shopping.catalog.lookup", "dev.ucp.shopping.catalog.search"]
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/valid-with-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/valid-with-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-23",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-23",
          "spec": "https://ucp.dev/2026-01-23/specification/overview",
          "transport": "a2a",
          "endpoint": "https://example-business.com/.well-known/agent-card.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-01-23"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "extends": "dev.ucp.shopping.checkout",
          "version": "2026-01-23"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "extends": "dev.ucp.shopping.checkout",
          "version": "2026-01-23"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "extends": "dev.ucp.shopping.checkout",
          "version": "2026-01-23"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/valid-with-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/valid-with-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "draft",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/draft/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "draft"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.cart": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/cart",
          "schema": "https://ucp.dev/schemas/shopping/cart.json"
        }
      ],
      "dev.ucp.shopping.order": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/order",
          "schema": "https://ucp.dev/schemas/shopping/order.json"
        }
      ],
      "dev.ucp.shopping.catalog.search": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/catalog/search",
          "schema": "https://ucp.dev/draft/schemas/shopping/catalog_search.json"
        }
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/catalog/lookup",
          "schema": "https://ucp.dev/draft/schemas/shopping/catalog_lookup.json"
        }
      ],
      "dev.shopify.catalog": [
        {
          "version": "draft",
          "spec": "https://shopify.dev/docs/agents/catalog/storefront-catalog",
          "schema": "https://shopify.dev/ucp/schemas/draft/shopify_catalog.json",
          "extends": ["dev.ucp.shopping.catalog.lookup", "dev.ucp.shopping.catalog.search"]
        }
      ],
      "dev.shopify.catalog.global": [
        {
          "version": "draft",
          "spec": "https://shopify.dev/docs/agents/catalog/global-catalog",
          "schema": "https://shopify.dev/ucp/schemas/draft/shopify_catalog_global.json",
          "extends": ["dev.ucp.shopping.catalog.lookup", "dev.ucp.shopping.catalog.search"]
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

### Only checkout capabilities

A platform (an agent) declares only the checkout capability, with no extensions (for example fulfillment, discount, or buyer consent). The business intersects and returns checkout alone. Negotiation succeeds, but tools won't include fulfillment or discount input fields in their schemas.

The examples below exercise that minimal path. You can use them to test an agent that only needs basic checkout without shipping or discount support.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/checkout-only.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/checkout-only.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-08-25",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-08-25/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-08-25"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/checkout-only.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/checkout-only.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-04-08",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-04-08"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/checkout-only.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/checkout-only.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-23",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-23",
          "spec": "https://ucp.dev/2026-01-23/specification/overview",
          "transport": "a2a",
          "endpoint": "https://example-business.com/.well-known/agent-card.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-01-23"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/checkout-only.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/checkout-only.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "draft",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/draft/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "draft"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

***

## Invalid profiles

These fixtures demonstrate profiles that will result in negotiation failures.

* [Empty capabilities](#empty-capabilities)
* [Missing version](#missing-version)
* [Unsupported version](#unsupported-version)
* [Capability version mismatch](#capability-version-mismatch)
* [Profile too large](#profile-too-large)
* [Malformed JSON](#malformed-json)

### Empty capabilities

A platform declares a valid UCP profile with the correct version but no capabilities. The business has nothing to intersect with, so negotiation cannot succeed.

The examples below surface that scenario. You can use them to test what happens when an agent connects without declaring any capabilities.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/empty-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/empty-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-08-25",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-08-25/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {},
    "payment_handlers": {}
  }
}
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/empty-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/empty-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-04-08",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {},
    "payment_handlers": {}
  }
}
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/empty-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/empty-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-23",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-23",
          "spec": "https://ucp.dev/2026-01-23/specification/overview",
          "transport": "a2a",
          "endpoint": "https://example-business.com/.well-known/agent-card.json"
        }
      ]
    },
    "capabilities": {},
    "payment_handlers": {}
  }
}
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/empty-capabilities.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/empty-capabilities.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "draft",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/draft/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {},
    "payment_handlers": {}
  }
}
```

### Missing version

The profile is valid JSON but omits the `ucp.version` field. The business cannot determine which protocol version the agent targets, so version negotiation fails before capability intersection.

The examples below let you verify that agents without a declared protocol version are rejected early.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/missing-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/missing-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-08-25/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-08-25"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-08-25",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-08-25",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-08-25",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.catalog.search": [
        {
          "version": "2026-08-25"
        }
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          "version": "2026-08-25"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/missing-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/missing-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-04-08"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-04-08",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-04-08",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-04-08",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/missing-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/missing-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-23",
          "spec": "https://ucp.dev/2026-01-23/specification/overview",
          "transport": "a2a",
          "endpoint": "https://example-business.com/.well-known/agent-card.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-01-23"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/missing-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/missing-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/draft/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "draft"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

### Unsupported version

The profile declares a `ucp.version` the business does not support. Version negotiation fails immediately and capability intersection is not attempted.

The examples below let you test that unknown protocol versions are rejected before any capability processing begins.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/unsupported-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/unsupported-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-11",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-11",
          "spec": "https://ucp.dev/2026-01-11/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-01-11/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-08-25"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-08-25",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-08-25",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-08-25",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.catalog.search": [
        {
          "version": "2026-08-25"
        }
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          "version": "2026-08-25"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/unsupported-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/unsupported-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-11",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-11",
          "spec": "https://ucp.dev/2026-01-11/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-01-11/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-04-08"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-04-08",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-04-08",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-04-08",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/unsupported-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/unsupported-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-11",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-23",
          "spec": "https://ucp.dev/2026-01-23/specification/overview",
          "transport": "a2a",
          "endpoint": "https://example-business.com/.well-known/agent-card.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-01-23"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/unsupported-ucp-version.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/unsupported-ucp-version.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-11",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-11",
          "spec": "https://ucp.dev/2026-01-11/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-01-11/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "draft"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.discount": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

### Capability version mismatch

The platform declares multiple capabilities, but one uses a version the business does not support. Intersection keeps the matching capabilities and drops the mismatched one so you get partial negotiation: compatible capabilities succeed and the rest are excluded.

The examples below let you test partial intersection instead of an all-or-nothing failure.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/capability-version-mismatch.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/capability-version-mismatch.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-08-25",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-08-25",
          "spec": "https://ucp.dev/2026-08-25/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-08-25/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-08-25"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2099-01-23",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-08-25",
          "extends": "dev.ucp.shopping.checkout"
        }],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-08-25",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.catalog.search": [
        {
          "version": "2026-08-25"
        }
      ],
      "dev.ucp.shopping.catalog.lookup": [
        {
          "version": "2026-08-25"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/capability-version-mismatch.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/capability-version-mismatch.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-04-08",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-04-08",
          "spec": "https://ucp.dev/2026-04-08/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-04-08"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2099-01-23",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-04-08",
          "extends": "dev.ucp.shopping.checkout"
        }],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-04-08",
          "extends": ["dev.ucp.shopping.checkout", "dev.ucp.shopping.cart"]
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/capability-version-mismatch.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/capability-version-mismatch.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "2026-01-23",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "2026-01-23",
          "spec": "https://ucp.dev/2026-01-23/specification/overview",
          "transport": "a2a",
          "endpoint": "https://example-business.com/.well-known/agent-card.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "2026-01-23"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2099-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }],
      "dev.ucp.shopping.discount": [
        {
          "version": "2026-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/capability-version-mismatch.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/capability-version-mismatch.json
```

Which contains the following:

```json
{
  "ucp": {
    "version": "draft",
    "services": {
      "dev.ucp.shopping": [
        {
          "version": "draft",
          "spec": "https://ucp.dev/draft/specification/overview",
          "transport": "mcp",
          "schema": "https://ucp.dev/draft/services/shopping/mcp.openrpc.json"
        }
      ]
    },
    "capabilities": {
      "dev.ucp.shopping.checkout": [
        {
          "version": "draft"
        }
      ],
      "dev.ucp.shopping.fulfillment": [
        {
          "version": "2099-01-23",
          "extends": "dev.ucp.shopping.checkout"
        }
      ],
      "dev.ucp.shopping.buyer_consent": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }],
      "dev.ucp.shopping.discount": [
        {
          "version": "draft",
          "extends": "dev.ucp.shopping.checkout"
        }
      ]
    },
    "payment_handlers": {}
  }
}
```

### Profile too large

The profile is valid JSON but exceeds the maximum allowed payload size. The business rejects it before parsing. Expect a `profile_too_large` error: no version negotiation or capability intersection runs.

The examples below let you test the size limit guard and reject oversized profiles early.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/too-large.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/too-large.json
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/too-large.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/too-large.json
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/too-large.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/too-large.json
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/too-large.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/too-large.json
```

### Malformed JSON

The payload is not valid JSON, so the profile cannot be parsed. Use these examples to test parse error handling and resilience.

#### 2026-08-25

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-08-25/malformed.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-08-25/malformed.json
```

#### 2026-04-08

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-04-08/malformed.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-04-08/malformed.json
```

#### 2026-01-23

Copy the following [link](https://shopify.dev/ucp/agent-profiles/2026-01-23/malformed.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/2026-01-23/malformed.json
```

#### draft

Copy the following [link](https://shopify.dev/ucp/agent-profiles/draft/malformed.json) into the `meta.ucp-agent.profile` field of your MCP request:

```text
https://shopify.dev/ucp/agent-profiles/draft/malformed.json
```

***
