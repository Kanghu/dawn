---
title: About app proxies and dynamic data
description: App proxies allow the display of dynamic data within storefronts.
source_url:
  html: 'https://shopify.dev/docs/apps/build/online-store/app-proxies'
  md: 'https://shopify.dev/docs/apps/build/online-store/app-proxies.md'
---

# About app proxies and dynamic data

App proxies take requests to Shopify URLs, and proxy them to your app. This allows you to fetch and display data on a storefront from an external source.

A Shopify app can have only one proxy route configured. Any paths under this root URL will proxy to your app.

***

## How it works

Shopify will proxy a storefront URL to your app based on your [app proxy configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#app_proxy):

## shopify.app.toml

```toml
[app_proxy]
url = "/my-app-proxy"
prefix = "apps"
subpath = "my-custom-path"
```

In this example:

* `https://<shop_url>/apps/my-custom-path` will proxy to `https://<application_url>/my-app-proxy`.
* `https://<shop_url>/apps/my-custom-path/child-route` will proxy to `https://<application_url>/my-app-proxy/child-route`.

Configuring an app proxy requires the `write_app_proxy` [access scope](https://shopify.dev/docs/api/usage/access-scopes#authenticated-access-scopes).

**Note:**

You can also configure an app proxy in the Dev Dashboard by navigating to **Apps** > **{your app}** > **Versions** > **Create a version** > **App proxy**. However, Shopify recommends [file-based configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration) which can be source controlled and deployed via Shopify CLI.

***

## Getting started

Use the following steps to create an app proxy using the Shopify React Router template.

### Requirements

* You're a [user with app development permissions](https://shopify.dev/docs/apps/build/dev-dashboard/user-permissions) and have created a [dev store](https://shopify.dev/docs/apps/build/stores/development-stores). You can create one by running `shopify store create dev`.

- You're using the latest version of [Shopify CLI](https://shopify.dev/docs/api/shopify-cli).
- You're using the latest version of [Chrome](https://www.google.com/chrome/) or [Firefox](https://www.mozilla.org/).

* You've [created an app that uses the React Router template](https://shopify.dev/docs/apps/build/scaffold-app).

### Step 1: Create the proxy route

1. If it's not already running, start the `shopify app dev` command.

   ## Terminal

   ```terminal
   shopify app dev
   ```

2. Create a route in your app to [handle proxy requests](https://shopify.dev/docs/apps/build/online-store/display-dynamic-data#how-it-works) at `app/routes/my-app-proxy.jsx`:

   ## app/routes/my-app-proxy.jsx

   ```jsx
   import { authenticate } from "../shopify.server";
   import { useLoaderData } from "react-router";


   export const loader = async ({ request }) => {
     // Use the authentication API from the React Router template
     await authenticate.public.appProxy(request);


     // Read URL parameters added by Shopify when proxying
     const url = new URL(request.url);


     return {
       shop: url.searchParams.get("shop"),
       loggedInCustomerId: url.searchParams.get("logged_in_customer_id"),
     };
   };


   export default function MyAppProxy() {
     const { shop, loggedInCustomerId } = useLoaderData();


     return <div>{`Hello world from ${loggedInCustomerId || "not-logged-in"} on ${shop}`}</div>;
   }
   ```

### Step 2: Update configuration

1. In `shopify.app.toml` in the root of your app, add the [`write_app_proxy`](https://shopify.dev/docs/api/usage/access-scopes) access scope.

   ## shopify.app.toml

   ```toml
   [access_scopes]
   scopes = "write_app_proxy"
   ```

2. In the same app configuration file, add your [app proxy configuration](#app-proxy-properties):

   ## shopify.app.toml

   ```toml
   [app_proxy]
   url = "/my-app-proxy"
   prefix = "apps"
   subpath = "my-custom-path"
   ```

### Step 3: Test the app proxy

1. The `shopify app dev` command will automatically update the app on your dev store.

2. Test the proxy by opening the proxied path on your storefront. In this example that's `https://<shop_url>/apps/my-custom-path`.

**Note:**

Changes to `url` take effect immediately on every store where the app is installed. Changes to `prefix` and `subpath` apply only to new installations, because [users can customize](#user-customization) those values on a per-store basis. To change the proxied path on a dev store that already has the app installed, either change it in your dev store admin, or uninstall and reinstall the app.

***

## App proxy properties

All properties are required.

| Property | Description |
| - | - |
| `url` | This can either be:- A relative URL for your proxy endpoint. Shopify will prepend your app URL during `shopify app dev` and `shopify app deploy.`
- An absolute URL for your proxy endpoint. If [enabled in your app config](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#build), Shopify will update the host name with your app URL during `shopify app dev`. |
| `prefix` | The first part of the proxy URL on the shop. It must match an [allowed value](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#app_proxy) (`a`, `apps`, `community`, or `tools`). |
| `subpath` | The second part of the proxy URL on the shop. It may contain letters, numbers, underscores, and hyphens up to 30 characters. The value may not be `admin`, `services`, `password`, or `login`. |

***

## User customization

Users can change the subpath or prefix of app proxies in the Shopify admin:

1. Go to **Settings** > **Apps**. If the app is a sales channel, then go to **Settings** > **Sales channels** instead.
2. Click the app to open its details page.
3. In the **App Proxy URL** section, click **Customize URL**.

The change takes effect immediately, and applies only to that store.

While users can change this information to get a friendlier URL that fits their store's information architecture, these changes don't affect the root destination URL for your proxy endpoint.

Because these values are configurable by users, changes to the `subpath` and `prefix` in your app will only apply to new app installations.

***

## Liquid response

App proxies support [Liquid](https://shopify.dev/docs/api/liquid), Shopify's template language. An app proxy response that contains Liquid will be rendered with store data into HTML like it was part of the store's theme.

If the HTTP response from the proxy URL has `Content-Type: application/liquid` set in its headers, then Shopify renders any Liquid code in the request body in the context of the shop using the shop's theme. Otherwise, the response is returned directly to the client. Also, any [30x redirects](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#3xx_Redirection) are followed.

***

## Disallowed headers

Due to security concerns, the following headers are stripped from app proxy responses:

* `Accept-Patch`
* `Accept-Ranges`
* `Connection`
* `Cookie`
* `Date`
* `Delta-Base`
* `IM`
* `P3P`
* `Pragma`
* `Preference-Applied`
* `Proxy-Authenticate`
* `Public-Key-Pins`
* `Server`
* `Service-Worker-Allowed`
* `Set-Cookie`
* `Trailer`
* `Tk`
* `Warning`
* `X-Powered-By`

***

## Next steps

* If you're not using the React Router template, then you can [build your own authentication for app proxies](https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies).
* Explore the [app configuration reference](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#app_proxy) for app proxies.

***
