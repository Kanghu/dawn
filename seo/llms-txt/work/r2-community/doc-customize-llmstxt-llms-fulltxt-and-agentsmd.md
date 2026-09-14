---
title: >-
  Customize /llms.txt, /llms-full.txt and /agents.md - Shopify developer
  changelog
description: >-
  Shopify’s developer changelog documents all changes to Shopify’s platform.
  Find the latest news and learn about new platform opportunities.
source_url:
  html: 'https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd'
  md: 'https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd.md'
metadata:
  effectiveApiVersion: ''
  affectedApi: []
  primaryTag:
    displayName: Themes
    handle: dev_themes
  secondaryTag:
    displayName: New
    handle: new
  indicatesActionRequired: false
  createdAt: '2026-05-28T07:46:46-04:00'
  postedAt: '2026-05-28T16:00:00-04:00'
  updatedAt: '2026-06-04T15:18:22-04:00'
  effectiveAt: '2026-05-29T16:00:00-04:00'
---

May 28, 2026

# Customize /llms.txt, /llms-full.txt and /agents.md

DateMay 28, 2026

FlagsNew

SurfacesThemes

Your store includes a default `agents.md` file accessible at `/agents.md`. The paths `/llms.txt` and `/llms-full.txt` also point to this content by default.

Add any of the following templates under Online Store > Themes > Edit code to serve different content per path:

* `templates/agents.md.liquid` — controls /agents.md (and the default for the other two paths)
* `templates/llms.txt.liquid` — controls /llms.txt only
* `templates/llms-full.txt.liquid` — controls /llms-full.txt only

If no template is present for a given path, it falls back to your agents.md template, then to the Shopify-generated default. See the [updated documentation](https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid) for more details.
