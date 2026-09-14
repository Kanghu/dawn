---
title: llms.txt.liquid
description: >-
  Learn about the llms.txt template, which generates the llms.txt file served to
  AI agents and crawlers.
source_url:
  html: >-
    https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid
  md: >-
    https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid.md
api_name: liquid
---

# llms.​txt.​liquid

The `llms.txt.liquid` template renders the `llms.txt` file, which is hosted at the `/llms.txt` URL.

`/llms.txt` is an agent-discovery file and an alternate URL for [`/agents.md`](https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid), which is the canonical agent-discovery document. By default, Shopify manages `/llms.txt` by mirroring the content of `/agents.md`, so agents and crawlers that request it still find a usable, agent-facing description of the store. For most stores, the managed file is all you need. As a result, this template isn't included in any themes by default.

**Tip:**

The `llms.txt` file is served at the bare primary domain, without a locale or [Shopify Markets](https://shopify.dev/docs/storefronts/themes/markets) subfolder prefix. It has no localized counterpart.

***

## When to use this template

In most cases, don't add a separate `llms.txt.liquid` template. Shopify's managed default keeps `/llms.txt` aligned with `/agents.md` without extra theme maintenance. If you want to customize the agent-discovery content for every URL at once, then add an [`agents.md.liquid`](https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid) template instead. `/llms.txt` falls back to it automatically.

Add an `llms.txt.liquid` template only when you have an advanced requirement for `/llms.txt` to diverge from `/agents.md`. When you add this template, you hand-edit the Liquid template and take responsibility for keeping its content current. The template lookup order for `/llms.txt` is:

1. `llms.txt.liquid` (if present)
2. [`agents.md.liquid`](https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid) (if present)
3. The Shopify-generated default

So a dedicated `llms.txt.liquid` takes precedence for `/llms.txt` only, while `/agents.md` and `/llms-full.txt` are unaffected.

***

## Location

The `llms.txt.liquid` template is located in the `templates` directory of the theme:

```text
└── theme
  ├── layout
  ├── templates
  |   ...
  |   ├── llms.txt.liquid
  |   ...
  ...
```

If your theme doesn't already contain the `llms.txt.liquid` template, then you can add it with the following steps:

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
4) Name the file `llms.txt.liquid`.
5) Press Enter to create the file.

***

## Content

This template can't be a [JSON template](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates). It must be `llms.txt.liquid`.

The template accepts standard text or Markdown and [Liquid](https://shopify.dev/docs/api/liquid). Like [`agents.md.liquid`](https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid#the-agents-object), it has access to the `agents` object for auto-populated UCP and agent-interaction metadata. As with `agents.md.liquid`, this template renders with a restricted Liquid context: only the [`request`](https://shopify.dev/docs/api/liquid/objects/request) object and the `agents` object are available, and the standard [global Liquid objects](https://shopify.dev/docs/api/liquid/objects) such as [`shop`](https://shopify.dev/docs/api/liquid/objects/shop), `articles`, and `collections` are not injected. For the full list of `agents` properties, refer to [agents.md.liquid](https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid#the-agents-object).

For example:

## templates/llms.txt.liquid

```liquid
# {{ agents.store_name }}


> Agent-discovery summary. The canonical, full description is at {{ agents.store_url }}/agents.md.


- UCP discovery: {{ agents.ucp_discovery_url }}
- MCP endpoint: {{ agents.mcp_endpoint_url }}
- Sitemap: {{ agents.sitemap_url }}
```

***

## Usage

Use the Shopify-managed default unless you need custom content that differs from `/agents.md`. To customize the agent-discovery content for `/agents.md`, `/llms.txt`, and `/llms-full.txt` together, edit [`agents.md.liquid`](https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid). Use `llms.txt.liquid` only when `/llms.txt` needs content that differs from `/agents.md`.

***
