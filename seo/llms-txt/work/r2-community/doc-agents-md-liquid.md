---
title: agents.md.liquid
description: >-
  Learn about the agents.md template, which generates an agents.md file that
  tells AI agents how to discover and interact with a store.
source_url:
  html: >-
    https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid
  md: >-
    https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid.md
api_name: liquid
---

# agents.​md.​liquid

The `agents.md.liquid` template renders the `agents.md` file, which is hosted at the `/agents.md` URL.

The `agents.md` file is the canonical, agent-facing description of a store. It tells AI agents and shopping assistants how to discover the store's commerce capabilities and how to transact with it, including:

* The store's [Universal Commerce Protocol (UCP)](https://ucp.dev) discovery and Model Context Protocol (MCP) endpoints.
* Read-only browsing URLs for product, collection, and search data.
* The store's published policies.
* Guidance for personal shopping agents, such as the [Shop skill](https://shop.app/SKILL.md).

Shopify manages an `agents.md` file by default for every store. For most stores, the managed file is all you need. It stays aligned with Shopify's agent-discovery capabilities and the store's commerce configuration without extra theme maintenance.

Add an `agents.md.liquid` template only when you have advanced requirements that the managed file doesn't cover. When you add this template, you hand-edit the Liquid template and take responsibility for keeping its content current.

**Tip:**

The `agents.md` file is served at the bare primary domain, without a locale or [Shopify Markets](https://shopify.dev/docs/storefronts/themes/markets) subfolder prefix. It has no localized counterpart.

***

## Relationship to llms.​txt and llms-full.​txt

`agents.md` is the canonical agent-discovery document. The [`/llms.txt`](https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid) and [`/llms-full.txt`](https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-full-txt-liquid) URLs are alternate URLs that mirror the content of `/agents.md` by default on Shopify stores, so agents that request either one still find a usable document.

Because of this, the `agents.md.liquid` template is the fallback for all three URLs. When a request is served, Shopify looks for a theme template in the following order, and uses the first one it finds:

| URL | Template lookup order |
| - | - |
| `/agents.md` | `agents.md.liquid` → Shopify-generated default |
| `/llms.txt` | `llms.txt.liquid` → `agents.md.liquid` → Shopify-generated default |
| `/llms-full.txt` | `llms-full.txt.liquid` → `agents.md.liquid` → Shopify-generated default |

This means that if you add only an `agents.md.liquid` template, then it's used for all three URLs. To make one of the `llms` URLs diverge, add a dedicated [`llms.txt.liquid`](https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid) or [`llms-full.txt.liquid`](https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-full-txt-liquid) template. It takes precedence for that URL only, while the others keep mirroring `agents.md`.

***

## Location

The `agents.md.liquid` template is located in the `templates` directory of the theme:

```text
└── theme
  ├── layout
  ├── templates
  |   ...
  |   ├── agents.md.liquid
  |   ...
  ...
```

If your theme doesn't already contain the `agents.md.liquid` template, then you can add it with the following steps:

#### Desktop

1. From your Shopify admin, go to **Online Store** > **Themes**.

2. Find the theme that you want to edit, and then click **...** > **Edit code**.

#### Mobile

1. From the [Shopify app](https://www.shopify.com/install/detect), tap **Store**.

2. In the **Sales channels** section, tap **Online Store**.

3. Tap **Manage all themes**.

4. Find the theme that you want to edit, and then tap **...** > **Edit code**.

1) In the left sidebar, locate the **Templates** folder.
2) Right-click on the **Templates** folder.
3) Click **New File** from the context menu.
4) Name the file `agents.md.liquid`.
5) Press Enter to create the file.

***

## Content

This template can't be a [JSON template](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates). It must be `agents.md.liquid`.

The template accepts standard Markdown and [Liquid](https://shopify.dev/docs/api/liquid). To help you build agent instructions with values that stay in sync with the store's actual commerce configuration, the template exposes an `agents` object.

Unlike most theme templates, `agents.md.liquid` renders with a restricted Liquid context. Only two objects are available:

* [`request`](https://shopify.dev/docs/api/liquid/objects/request)
* `agents` (the auto-populated object described [below](#the-agents-object))

The standard [global Liquid objects](https://shopify.dev/docs/api/liquid/objects) aren't injected, so they render blank. This includes [`shop`](https://shopify.dev/docs/api/liquid/objects/shop), `articles`, `blogs`, `collections`, `pages`, and `linklists`. The restriction keeps the file safe to cache broadly and serve to every agent.

**Caution:**

To include store data, reference it through the `agents` object or hardcode the values you need. Standard theme objects such as `shop` and `collections` don't work in this template.

### The `agents` object

The `agents` object provides auto-populated UCP and agent-interaction metadata for the store:

| Property | Type | Description |
| - | - | - |
| `agents.store_name` | string | The name of the store. |
| `agents.store_url` | string | The full URL of the store, using the bare primary domain. |
| `agents.ucp_discovery_url` | string | The UCP discovery URL for the store (`{store_url}/.well-known/ucp`). |
| `agents.mcp_endpoint_url` | string | The MCP (Model Context Protocol) endpoint URL (`{store_url}/api/ucp/mcp`). |
| `agents.ucp_versions` | array of string | The supported UCP versions, newest first. Derived from the store's UCP implementation, so it stays in sync automatically. |
| `agents.currency` | string | The store's primary currency code, such as `USD`. |
| `agents.sitemap_url` | string | The store's sitemap URL (`{store_url}/sitemap.xml`). |

For example:

## templates/agents.md.liquid

```liquid
# Agent Instructions — {{ agents.store_name }}


This document describes how AI agents can interact with the online store at {{ agents.store_url }}.


## Commerce Protocol (UCP)


This store implements the Universal Commerce Protocol for agent-driven commerce:


- Discovery: `GET {{ agents.ucp_discovery_url }}`
- MCP endpoint: `POST {{ agents.mcp_endpoint_url }}`


### Supported UCP versions
{% for version in agents.ucp_versions %}
- {{ version }}{% if forloop.first %} (latest stable){% endif %}
{% endfor %}


## Read-only browsing


- All products: `GET /collections/all`
- Product JSON: `GET /products/{handle}.json`
- Sitemap: {{ agents.sitemap_url }}


Pricing and availability are returned in {{ agents.currency }}.
```

**Caution:**

Avoid outputting potentially private merchant data, such as contact email addresses or phone numbers, in this file. The Shopify-generated `agents.md` deliberately omits contact details because the file is broadly cached and served to every agent that requests it.

***

## Usage

When you provide an `agents.md.liquid` template, it replaces the Shopify-managed `agents.md` and, unless overridden, the content served at [`/llms.txt`](https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid) and [`/llms-full.txt`](https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-full-txt-liquid).

Use the managed default unless you need custom agent instructions. If you do customize the template, then keep the UCP and MCP endpoints discoverable by using the `agents` object rather than hardcoding URLs. The auto-populated values stay in sync as the store's commerce configuration changes.

***
