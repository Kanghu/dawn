---
title: Storefront Catalog MCP
description: >-
  Use Shopify's UCP catalog tools to search, look up, and get product details
  from a single merchant's storefront.
source_url:
  html: 'https://shopify.dev/docs/agents/catalog/storefront-catalog'
  md: 'https://shopify.dev/docs/agents/catalog/storefront-catalog.md'
---

# Storefront Catalog MCP

The Storefront Catalog MCP server enables AI agents to search and discover products from a single merchant's catalog, helping buyers find and purchase products from that store.

Storefront Catalog MCP implements the [UCP Catalog capability](https://ucp.dev/2026-08-25/specification/shopping/catalog/) and its [MCP binding](https://ucp.dev/2026-08-25/specification/shopping/catalog/mcp/). The names, request and response shapes of tools conform to the [UCP specification](https://ucp.dev/2026-08-25/specification/shopping/catalog/).

## When to use Storefront Catalog MCP

Use Storefront Catalog MCP whenever buyer intent and query are scoped to a single merchant. For example, use Storefront Catalog MCP when building a storefront AI agent. For cross-merchant product discovery, use [Global Catalog MCP](https://shopify.dev/docs/agents/catalog/global-catalog).

***

## Use with the AI Toolkit

The [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) [installs](https://shopify.dev/docs/agents#get-started) the `ucp` skill, which lets agents in Cursor, Claude Code, and other compatible IDEs scope catalog operations to a single merchant. Ask your assistant in natural language (`"search nike.com for running shoes"`) and the skill picks the right [UCP CLI](https://github.com/Shopify/ucp-cli) command, or pass `--business <merchant-url>` on any `ucp catalog` command directly in a terminal.

Use `--input-schema` against any of these commands to fetch the merchant's live input schema before composing a payload.

##### Search this storefront

```bash
ucp catalog search --business https://{shop}.example.com \
  --set /query='cold brew' \
  --view :compact \
  --format md
```

##### Lookup by IDs

```bash
ucp catalog lookup --business https://{shop}.example.com \
  --set '/ids/0=gid://shopify/ProductVariant/12345'
```

##### Get product

```bash
ucp catalog get_product gid://shopify/Product/67890 \
  --business https://{shop}.example.com \
  --set '/selected/0={"name":"Bag size","label":"12 oz"}'
```

***

## Available tools

Replace `storedomain` with the store's actual domain. The `/api/ucp/mcp` endpoint requires an [agent profile](https://shopify.dev/docs/agents/get-started/profile) — every request must include a `meta.ucp-agent.profile` URL pointing to your agent's UCP profile. The returned tools depend on the capabilities your agent advertises.

* [`search_catalog`](#search_catalog): Search the store's product catalog.
* [`lookup_catalog`](#lookup_catalog): Batch lookup products or variants by identifier.
* [`get_product`](#get_product): Get full product details with variant selection.

**UCP catalog specification:**

These tools conform to the [Universal Commerce Protocol catalog specification](https://ucp.dev/2026-08-25/specification/shopping/catalog/). Refer to the UCP spec for the complete request/response schema.

For Shopify-specific extension fields (additional filters and variant fields), see [Storefront Catalog extension](https://shopify.dev/docs/agents/catalog/storefront-catalog-extension).

POST

## https://{storedomain}/api/ucp/mcp

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1,
  "params": {
    "arguments": {
      "meta": {
        "ucp-agent": {
          "profile": "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json"
        }
      }
    }
  }
}
```

### `search_catalog`

Searches the store's product catalog.

The response conforms to the [UCP catalog search response](https://ucp.dev/2026-08-25/specification/shopping/catalog/search/), including a UCP metadata envelope; products with title, description, price range (minor units), media, and variants; and cursor-based pagination.

When to use:

* A customer asks "Do you have any organic coffee?"
* You need to find products matching specific criteria.
* A customer wants to browse items in a category.

#### Parameters

All parameters are wrapped in a `catalog` object. Refer to the [UCP catalog search spec](https://ucp.dev/2026-08-25/specification/shopping/catalog/search/) for the complete schema.

***

catalog.query•string

Free-text search query. For example, "organic coffee beans", "winter jacket".

***

catalog.context•object

Buyer signals for relevance and localization (`address_country`, `language`, `currency`, `intent`).

***

catalog.pagination•object

Cursor-based pagination controls. Accepts `cursor` (string, opaque cursor from a previous response) and `limit` (integer, min `1`, default `10`, max `250`).

***

#### Call from the Shopify AI Toolkit and UCP CLI

With the [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) [installed](https://shopify.dev/docs/agents#get-started), ask your assistant in natural language (`"search <shop> for cold brew"`) and the `ucp` skill picks the right [UCP CLI](https://github.com/Shopify/ucp-cli) command. You can also run the command directly in a terminal:

## Search this storefront

```bash
ucp catalog search --business https://{shop}.example.com \
  --set /query='cold brew' \
  --view :compact \
  --format md
```

#### Call the tool directly

POST

## https://{storedomain}/api/ucp/mcp

##### cURL

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "search_catalog",
    "arguments": {
      "meta": {
        "ucp-agent": {
          "profile": "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json"
        }
      },
      "catalog": {
        "query": "organic coffee beans",
        "context": {
          "address_country": "US",
          "intent": "Customer prefers fair trade products"
        }
      }
    }
  }
}
```

##### {} Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "structuredContent": {
      "ucp": {
        "version": "2026-08-25",
        "capabilities": {
          "dev.ucp.shopping.catalog.search": [
            {"version": "2026-08-25"}
          ]
        }
      },
      "products": [
        {
          "id": "gid://shopify/Product/1001",
          "handle": "fair-trade-organic-whole-bean",
          "title": "Fair Trade Organic Whole Bean Coffee",
          "description": {
            "html": "USDA organic whole beans; Fair Trade Certified; medium roast. Roasted in small batches."
          },
          "url": "https://business.example.com/products/fair-trade-organic-whole-bean",
          "categories": [
            {"value": "413", "taxonomy": "google_product_category"},
            {"value": "fb-1-2-3", "taxonomy": "shopify"},
            {"value": "Food, Beverages & Tobacco > Beverages > Coffee", "taxonomy": "merchant"}
          ],
          "price_range": {
            "min": {"amount": 1899, "currency": "USD"},
            "max": {"amount": 3499, "currency": "USD"}
          },
          "media": [
            {
              "type": "image",
              "url": "https://cdn.example.com/products/fair-trade-organic-whole-bean.jpg",
              "alt_text": "Bag of fair trade organic whole bean coffee"
            }
          ],
          "options": [
            {
              "name": "Bag size",
              "values": [
                {"label": "12 oz"},
                {"label": "2 lb"},
                {"label": "5 lb"}
              ]
            }
          ],
          "variants": [
            {
              "id": "gid://shopify/ProductVariant/2001",
              "sku": "FT-ORG-WB-12OZ",
              "title": "12 oz",
              "description": {"plain": "12 oz bag — fair trade organic whole bean"},
              "price": {"amount": 1899, "currency": "USD"},
              "availability": {"available": true},
              "options": [{"name": "Bag size", "label": "12 oz"}],
              "tags": ["organic", "fair trade", "whole bean", "coffee"]
            }
          ],
          "rating": {"value": 4.7, "scale_max": 5, "count": 312},
          "metadata": {
            "certifications": ["USDA Organic", "Fair Trade Certified"]
          }
        }
      ],
      "pagination": {
        "cursor": "eyJwYWdlIjoxfQ==",
        "has_next_page": true,
        "total_count": 24
      }
    }
  }
}
```

### `lookup_catalog`

Retrieve products or variants by identifier.

The response conforms to the [UCP catalog lookup response](https://ucp.dev/2026-08-25/specification/shopping/catalog/lookup/), including products with `inputs` correlation on each variant and `not_found` messages for unresolved identifiers.

When to use:

* You have product or variant IDs from search results or deep links.
* You need to resolve multiple identifiers in a single request.
* You're validating cart items against current catalog data.

#### Parameters

All parameters are wrapped in a `catalog` object. Refer to the [UCP catalog lookup spec](https://ucp.dev/2026-08-25/specification/shopping/catalog/lookup/) for the complete schema.

***

catalog.ids•arrayRequired (critical)

Array of product or variant identifiers (up to 10). For example, "gid://shopify/Product/123".

***

#### Call from the Shopify AI Toolkit and UCP CLI

With the [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) [installed](https://shopify.dev/docs/agents#get-started), ask your assistant in natural language (`"look up these variants at <shop>"`) and the `ucp` skill picks the right [UCP CLI](https://github.com/Shopify/ucp-cli) command. You can also run the command directly in a terminal:

## Lookup by IDs

```bash
ucp catalog lookup --business https://{shop}.example.com \
  --set '/ids/0=gid://shopify/ProductVariant/12345'
```

#### Call the tool directly

POST

## https://{storedomain}/api/ucp/mcp

##### cURL

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "lookup_catalog",
    "arguments": {
      "meta": {
        "ucp-agent": {
          "profile": "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json"
        }
      },
      "catalog": {
        "ids": [
          "gid://shopify/Product/123",
          "gid://shopify/ProductVariant/456"
        ],
        "context": {
          "address_country": "US"
        }
      }
    }
  }
}
```

##### {} Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "structuredContent": {
      "ucp": {
        "version": "2026-08-25",
        "capabilities": {
          "dev.ucp.shopping.catalog.lookup": [
            {"version": "2026-08-25"}
          ]
        }
      },
      "products": [
        {
          "id": "gid://shopify/Product/123",
          "title": "Blue Runner Pro",
          "description": {
            "html": "Lightweight running shoes with responsive cushioning."
          },
          "price_range": {
            "min": {"amount": 12000, "currency": "USD"},
            "max": {"amount": 12000, "currency": "USD"}
          },
          "variants": [
            {
              "id": "gid://shopify/ProductVariant/789",
              "sku": "BRP-BLU-10",
              "title": "Size 10",
              "description": {"plain": "Size 10 variant"},
              "price": {"amount": 12000, "currency": "USD"},
              "availability": {"available": true},
              "inputs": [
                {"id": "gid://shopify/Product/123", "match": "featured"}
              ],
              "tags": ["running", "road", "neutral"],
              "seller": {
                "name": "Example Store",
                "links": [
                  {
                    "type": "refund_policy",
                    "url": "https://business.example.com/policies/refunds"
                  }
                ]
              }
            }
          ],
          "metadata": {
            "collection": "Winter 2026",
            "technology": {
              "midsole": "React foam",
              "outsole": "Continental rubber"
            }
          }
        },
        {
          "id": "gid://shopify/Product/880",
          "title": "Trail Master X",
          "description": {
            "plain": "Rugged trail running shoes with aggressive tread."
          },
          "price_range": {
            "min": {"amount": 15000, "currency": "USD"},
            "max": {"amount": 15000, "currency": "USD"}
          },
          "variants": [
            {
              "id": "gid://shopify/ProductVariant/456",
              "sku": "TMX-GRN-11",
              "title": "Size 11 - Green",
              "description": {"plain": "Size 11 Green variant"},
              "price": {"amount": 15000, "currency": "USD"},
              "availability": {"available": true},
              "inputs": [
                {"id": "gid://shopify/ProductVariant/456", "match": "exact"}
              ],
              "tags": ["trail", "waterproof"],
              "seller": {
                "name": "Example Store"
              }
            }
          ]
        }
      ]
    }
  }
}
```

### `get_product`

Retrieves full details for a single product with optional variant selection.

The response conforms to the [UCP catalog `get_product` response](https://ucp.dev/2026-08-25/specification/shopping/catalog/lookup/#response_1) including `product.selected` reflecting effective option selections, option values with `available` or `exists` signals, and variants matching the selection.

When to use:

* A customer has selected a product and needs full details.
* You need to show variant options with availability signals.
* A customer is making option selections (Color, Size, etc.).

#### Parameters

All parameters are wrapped in a `catalog` object. Refer to the [UCP catalog lookup spec](https://ucp.dev/2026-08-25/specification/shopping/catalog/lookup/) for the complete schema.

***

catalog.id•stringRequired (critical)

Product or variant identifier. For example, "gid://shopify/Product/123".

***

catalog.selected•array

Option selections for variant narrowing. For example, `[{"name": "Color", "label": "Blue"}]`.

***

#### Call from the Shopify AI Toolkit and UCP CLI

With the [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) [installed](https://shopify.dev/docs/agents#get-started), ask your assistant in natural language (`"show me this product on <shop> in 12 oz"`) and the `ucp` skill picks the right [UCP CLI](https://github.com/Shopify/ucp-cli) command. You can also run the command directly in a terminal:

## Get product

```bash
ucp catalog get_product gid://shopify/Product/67890 \
  --business https://{shop}.example.com \
  --set '/selected/0={"name":"Bag size","label":"12 oz"}'
```

#### Call the tool directly

POST

## https://{storedomain}/api/ucp/mcp

##### cURL

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 1,
  "params": {
    "name": "get_product",
    "arguments": {
      "meta": {
        "ucp-agent": {
          "profile": "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json"
        }
      },
      "catalog": {
        "id": "gid://shopify/Product/123",
        "selected": [
          {"name": "Color", "label": "Blue"}
        ],
        "context": {
          "address_country": "US"
        }
      }
    }
  }
}
```

##### {} Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "structuredContent": {
      "ucp": {
        "version": "2026-08-25",
        "capabilities": {
          "dev.ucp.shopping.catalog.lookup": [
            {"version": "2026-08-25"}
          ]
        }
      },
      "product": {
        "id": "gid://shopify/Product/123",
        "handle": "runner-pro",
        "title": "Runner Pro",
        "description": {
          "html": "Lightweight running shoes with responsive cushioning."
        },
        "url": "https://business.example.com/products/runner-pro",
        "price_range": {
          "min": {"amount": 12000, "currency": "USD"},
          "max": {"amount": 15000, "currency": "USD"}
        },
        "media": [
          {
            "type": "image",
            "url": "https://cdn.example.com/products/runner-pro-blue.jpg",
            "alt_text": "Runner Pro in Blue"
          }
        ],
        "options": [
          {
            "name": "Color",
            "values": [
              {"label": "Blue", "available": true, "exists": true},
              {"label": "Red", "available": true, "exists": true},
              {"label": "Green", "available": false, "exists": true}
            ]
          },
          {
            "name": "Size",
            "values": [
              {"label": "8", "available": true, "exists": true},
              {"label": "9", "available": true, "exists": true},
              {"label": "10", "available": true, "exists": true},
              {"label": "11", "available": false, "exists": false},
              {"label": "12", "available": true, "exists": true}
            ]
          }
        ],
        "selected": [
          {"name": "Color", "label": "Blue"}
        ],
        "variants": [
          {
            "id": "gid://shopify/ProductVariant/1001",
            "sku": "BRP-BLU-10",
            "title": "Blue, Size 10",
            "description": {"plain": "Blue, Size 10"},
            "price": {"amount": 12000, "currency": "USD"},
            "availability": {"available": true},
            "options": [
              {"name": "Color", "label": "Blue"},
              {"name": "Size", "label": "10"}
            ]
          },
          {
            "id": "gid://shopify/ProductVariant/1002",
            "sku": "BRP-BLU-12",
            "title": "Blue, Size 12",
            "description": {"plain": "Blue, Size 12"},
            "price": {"amount": 15000, "currency": "USD"},
            "availability": {"available": true},
            "options": [
              {"name": "Color", "label": "Blue"},
              {"name": "Size", "label": "12"}
            ]
          }
        ],
        "rating": {
          "value": 4.5,
          "scale_max": 5,
          "count": 128
        }
      }
    }
  }
}
```

***
