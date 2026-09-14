---
title: 'Liquid objects: request'
description: Information about the current URL and the associated page.
source_url:
  html: 'https://shopify.dev/docs/api/liquid/objects/request'
  md: 'https://shopify.dev/docs/api/liquid/objects/request.md'
api_name: liquid
---

# request

Information about the current URL and the associated page.

## Properties

* * **design\_​mode**

    [boolean](https://shopify.dev/docs/api/liquid/basics#boolean)

  * Returns `true` if the request is being made from within the theme editor. Returns `false` if not.

    You can use `request.design_mode` to control theme behavior depending on whether the theme is being viewed in the editor. For example, you can prevent session data from being tracked by tracking scripts in the theme editor.

    **Caution:** You shouldn\&#39;t use \<code>\<span class="PreventFireFoxApplyingGapToWBR">request.design\<wbr/>\_mode\</span>\</code> to change customer-facing functionality. The theme editor preview should match what the merchant\&#39;s customers see on the live store.

  * **host**

    [string](https://shopify.dev/docs/api/liquid/basics#string)

  * The domain that the request is hosted on.

  * **locale**

    [shop\_locale](https://shopify.dev/docs/api/liquid/objects/shop_locale)

  * The locale of the request.

  * **origin**

    [string](https://shopify.dev/docs/api/liquid/basics#string)

  * The protocol and host of the request.

    ExampleCreate a context-aware absolute URL

    You can use `request.origin` with any object, object property, or filter that returns a relative URL to build a context-aware absolute URL.

    ##### Code

    ```liquid
    {{ product.selected_variant.url | default: product.url | prepend: request.origin }}
    ```

    ##### Data

    ```json
    {
      "product": {
        "selected_variant": null,
        "url": "/products/health-potion"
      },
      "request": {
        "origin": "https://polinas-potent-potions.myshopify.com"
      }
    }
    ```

    ##### Output

    ```html
    https://polinas-potent-potions.myshopify.com/products/health-potion
    ```

  * **page\_​type**

    [string](https://shopify.dev/docs/api/liquid/basics#string) from a set of values

  * The type of page being requested.

    | Possible values |
    | - |
    | 404 |
    | article |
    | blog |
    | captcha |
    | cart |
    | collection |
    | list-collections |
    | customers/account |
    | customers/activate\_account |
    | customers/addresses |
    | customers/login |
    | customers/order |
    | customers/register |
    | customers/reset\_password |
    | gift\_card |
    | index |
    | metaobject |
    | page |
    | password |
    | policy |
    | product |
    | search |

  * **path**

    [string](https://shopify.dev/docs/api/liquid/basics#string)

  * The path of the request.

    **Note:** If the current path is for a page that doesn\&#39;t exist, then \<code>nil\</code> is returned.

  * **visual\_​preview\_​mode**

    [boolean](https://shopify.dev/docs/api/liquid/basics#boolean)

  * Returns `true` if the request is being made from within the theme editor's visual section preview. Returns `false` if not.

    You can use `request.visual_preview_mode` to control theme behavior depending on whether the theme is being viewed in the editor's visual section preview. For example, you can remove any scripts that interefere with how the section is displayed.

##### Example

```json
{
  "design_mode": false,
  "host": "polinas-potent-potions.myshopify.com",
  "locale": {},
  "origin": "https://polinas-potent-potions.myshopify.com",
  "page_type": "index",
  "path": "/",
  "visual_preview_mode": false
}
```
