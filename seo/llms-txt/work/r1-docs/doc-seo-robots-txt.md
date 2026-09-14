---
title: Customize robots.txt
description: >-
  Learn how to customize robots.txt to control which pages search engine
  crawlers can access.
source_url:
  html: 'https://shopify.dev/docs/storefronts/themes/seo/robots-txt'
  md: 'https://shopify.dev/docs/storefronts/themes/seo/robots-txt.md'
api_name: liquid
---

# Customize robots.​txt

The `robots.txt` file tells search engines which pages can, or can't, be crawled on a site. It contains groups of rules for doing so, and each group has three main components:

* The user agent, which notes which crawler the group of rules applies to. For example, `adsbot-google`.
* The rules themselves, which note specific URLs that crawlers can, or can't, access.
* An optional sitemap URL.

**Tip:**

To learn more about `robots.txt` and rule-set components, refer to [Google's documentation](https://developers.google.com/search/docs/advanced/robots/intro).

Shopify generates a default `robots.txt` file that works for most stores. However, you can add the [`robots.txt.liquid` template](https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid) to make customizations.

In this tutorial, you'll learn how you can customize the `robots.txt.liquid` template.

***

## Requirements

Add the `robots.txt.liquid` template with the following steps:

1. In the code editor for the theme you want to edit, locate the **Templates** folder.
2. Right-click on the **Templates** folder.
3. Click **New File** from the context menu.
4. Name the file `robots.txt.liquid`.
5. Press Enter to create the file.

***

## Resources

The `robots.txt.liquid` template supports only the following Liquid objects:

* [`robots`](https://shopify.dev/docs/api/liquid/objects/robots)
* [`group`](https://shopify.dev/docs/api/liquid/objects/group)
* [`rule`](https://shopify.dev/docs/api/liquid/objects/rule)
* [`user_agent`](https://shopify.dev/docs/api/liquid/objects/user_agent)
* [`sitemap`](https://shopify.dev/docs/api/liquid/objects/sitemap)
* [`request`](https://shopify.dev/docs/api/liquid/objects/request)

***

## Customize `robots.txt.liquid`

You can make the following customizations:

* [Add a new rule to an existing group](#add-a-new-rule-to-an-existing-group)
* [Remove a rule from an existing group](#remove-a-default-rule-from-an-existing-group)
* [Add custom rules](#add-custom-rules)

**Tip:**

The examples below make use of Liquid's [whitespace control](https://shopify.dev/docs/api/liquid/basics/whitespace) in order to maintain standard formatting.

While you can replace all of the template content with plain text rules, it's strongly recommended to use the provided Liquid objects whenever possible. The default rules are updated regularly to ensure that SEO best practices are always applied.

### Add a new rule to an existing group

If you want to add a new rule to an existing group, then you can adjust the Liquid for [outputting the default rules](https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid#content) to check for the associated group and include your rule.

For example, you can use the following to block all crawlers from accessing pages with the URL parameter `?q=`:

```liquid
{% for group in robots.default_groups %}
  {{- group.user_agent }}


  {%- for rule in group.rules -%}
    {{ rule }}
  {%- endfor -%}


  {%- if group.user_agent.value == '*' -%}
    {{ 'Disallow: /*?q=*' }}
  {%- endif -%}


  {%- if group.sitemap != blank -%}
	  {{ group.sitemap }}
  {%- endif -%}
{% endfor %}
```

#### Add host-specific rules

If you're using multiple domains for different markets, then you can create host-specific rules using the `request.host` object. You should only implement host-specific rules if you're using [Shopify Markets](https://shopify.dev/docs/storefronts/themes/markets) and you have distinct domains or subdomains that require different crawling behaviors per market.

For example, you could block crawling of English content on a French domain while maintaining default rules:

```liquid
{% for group in robots.default_groups %}
  {{- group.user_agent }}


  {%- for rule in group.rules -%}
    {{ rule }}
  {%- endfor -%}


  {%- if request.host == 'example.fr' -%}
    {{ 'Disallow: /en/' }}
  {%- endif -%}


  {%- if group.sitemap != blank -%}
	  {{ group.sitemap }}
  {%- endif -%}
{% endfor %}
```

### Remove a default rule from an existing group

If you want to remove a default rule from an existing group, then you can adjust the Liquid for [outputting the default rules](https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid#content) to check for that rule and skip over it.

For example, you can use the following to remove the rule blocking crawlers from accessing the `/policies/` page:

```liquid
{% for group in robots.default_groups %}
  {{- group.user_agent }}


  {%- for rule in group.rules -%}
    {%- unless rule.directive == 'Disallow' and rule.value == '/policies/' -%}
      {{ rule }}
    {%- endunless -%}
  {%- endfor -%}


  {%- if group.sitemap != blank -%}
	  {{ group.sitemap }}
  {%- endif -%}
{% endfor %}
```

### Add custom rules

If you want to add a new rule that's not part of a default group, then you can manually enter the rule outside of the Liquid for [outputting the default rules](https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid#content).

Common examples of these custom rules are:

* [Block certain crawlers](#block-certain-crawlers)
* [Allow certain crawlers](#allow-certain-crawlers)
* [Add extra sitemap URLs](#add-extra-sitemap-urls)

#### Block certain crawlers

If a crawler isn't in the default rule set, then you can manually add a rule to block it.

For example, the following directive would allow you to block the `discobot` crawler:

```text
<!-- Liquid for default rules -->


User-agent: discobot
Disallow: /
```

#### Allow certain crawlers

Similar to blocking certain crawlers, you can also manually add a rule to allow search engines to crawl a subdirectory or page.

For example, the following directive would allow the `discobot` crawler:

```text
<!-- Liquid for default rules -->


User-agent: discobot
Allow: /
```

#### Add extra sitemap URLs

The following example, where `[sitemap-url]` is the sitemap URL, would allow you to include an extra sitemap URL:

```text
<!-- Liquid for default rules -->


Sitemap: [sitemap-url]
```

***
