---
title: robots.txt.liquid
description: >-
  Learn about the robots.txt template, which generates a robots.txt file that
  tells search engines which pages can or can't be crawled on a site.
source_url:
  html: >-
    https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid
  md: >-
    https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid.md
api_name: liquid
---

# robots.​txt.​liquid

The `robots.txt.liquid` template renders the `robots.txt` file, which is hosted at the `/robots.txt` URL.

The `robots.txt` file tells search engines which pages can, or can't, be crawled on a site. It contains groups of rules for doing so, and each group has three main components:

* The user agent, which notes which crawler the group of rules applies to. For example, `adsbot-google`.
* The rules themselves, which note specific URLs that crawlers can, or can't, access.
* An optional sitemap URL.

Shopify generates a `robots.txt` file by default, which works for most shops, so this template isn't included in any themes by default.

**Tip:**

If you want to customize the `robots.txt.liquid` template, then refer to [Customize robots.txt](https://shopify.dev/docs/storefronts/themes/seo/robots-txt) for more information.

***

## Location

The `robots.txt.liquid` template is located in the `templates` directory of the theme:

```text
└── theme
  ├── layout
  ├── templates
  |   ...
  |   ├── robots.txt.liquid
  |   ...
  ...
```

If your theme doesn't already contain the `robots.txt.liquid` template, then you can add it with the following steps:

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
4) Name the file `robots.txt.liquid`.
5) Press Enter to create the file.

***

## Content

This template can't be a [JSON template](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates). It must be `robots.txt.liquid`.

The rules included in the default `robots.txt` file are mirrored through the Liquid [`robots` object](https://shopify.dev/docs/api/liquid/objects/robots), which the `robots.txt.liquid` template uses to output the rules.

For example:

## templates/robots.txt.liquid

```liquid
{% for group in robots.default_groups %}
  {{- group.user_agent -}}


  {% for rule in group.rules %}
    {{- rule -}}
  {% endfor %}


  {%- if group.sitemap != blank -%}
    {{ group.sitemap }}
  {%- endif -%}
{% endfor %}
```

While you can replace all the template content with plain text rules, it's strongly recommended to use the provided Liquid objects whenever possible. The default rules are updated regularly to ensure that SEO best practices are always applied.

***

## Usage

If you want to customize the `robots.txt.liquid` template, then you need to add it with the following steps:

1. In the code editor for the theme you want to edit, locate the **Templates** folder.
2. Right-click on the **Templates** folder.
3. Click **New File** from the context menu.
4. Name the file `robots.txt.liquid`.
5. Press Enter to create the file.

To learn about customizing this template, refer to [Customize robots.txt](https://shopify.dev/docs/storefronts/themes/seo/robots-txt).

***
