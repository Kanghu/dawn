---
title: Authenticate app proxies
description: Information about how to build your own authentication for app proxies.
source_url:
  html: >-
    https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies
  md: >-
    https://shopify.dev/docs/apps/build/online-store/app-proxies/authenticate-app-proxies.md
---

# Authenticate app proxies

If you are not using the [authentication API](https://shopify.dev/docs/api/shopify-app-react-router/latest/authenticate/public/app-proxy) provided in the Shopify React Router template, you can use the following information to understand how Shopify communicates with app proxy URLs.

***

## Handling proxy requests

Consider the components of an app proxy:

* Storefront URL: `https://{shop}.myshopify.com`
* Proxy URL: `https://proxy-domain.com/proxy`
* Client IP: `123.123.123.123`
* Shared secret: `hush`

When the following HTTP request sends from the client, Shopify forwards the request using the specified proxy URL:

```http
GET /apps/awesome_reviews/extra/path/components?extra=1&extra=2 HTTP/1.1
  Host: https://{shop}.myshopify.com
  Cookie: csrftoken=01234456789abcdef0123456789abcde;
  _session_id=1234456789abcdef0123456789abcdef;
  _secure_session_id=234456789abcdef0123456789abcdef0
```

The forwarded request looks like the following:

```http
GET /proxy/extra/path/components?extra=1&extra=2&shop={shop}.myshopify.com&logged_in_customer_id=1&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=4c68c8624d737112c91818c11017d24d334b524cb5c2b8ba08daa056f7395ddb HTTP/1.1
  Host: proxy-domain.com
  X-Forwarded-For: 123.123.123.123
  X-Forwarded-Host: {shop}.myshopify.com`
```

Notice that the forwarded request adds the following parameters:

| Parameter | Description |
| - | - |
| `logged_in_customer_id` | The ID of the [logged-in customer](https://help.shopify.com/en/manual/customers/customer-accounts). If no customer is logged in, then this value is empty. |
| `path_prefix` | The prefix and subpath which was proxied from the storefront. In this case, it's `/apps/awesome_reviews`. Because [users can customize](https://shopify.dev/docs/apps/build/online-store/app-proxies#user-customization) these values, this path may not match the current path in your app configuration. |
| `shop` | The `{shop}.myshopify.com` domain for the shop. |
| `signature` | A hexadecimal encoded [SHA-256](http://en.wikipedia.org/wiki/SHA-2) [HMAC](http://en.wikipedia.org/wiki/HMAC) of the other parameters, split on the "&" character, that is used to verify that the request was sent by Shopify. The signature is unencoded, sorted, concatenated and uses the application's shared secret as the HMAC key. |
| `timestamp` | The time in seconds since midnight of January 1, 1970 UTC. |

The forwarded request also adds the following headers:

* `X-Forwarded-Host`: The domain name of the client's request.
* `X-Forwarded-For`: The client IP address.

**Note:**

App proxies don't support cookies because the app is accessed through the shop's domain. Shopify strips the `Cookie` header from the request, and the `Set-Cookie` header from the response. Other headers are also stripped due to security concerns. To learn more, refer to [disallowed headers](https://shopify.dev/docs/apps/build/online-store/app-proxies#disallowed-headers).

Both the request method and request body are forwarded, meaning that content from the form submission and AJAX requests can be used in the proxy application. If this is the case, then the URL still contains the query parameters added by the proxy, such as `shop`, `logged_in_customer_id`, `path_prefix`, `timestamp`, and `signature`, even when the body also contains URL encoded parameters.

**Note:**

You shouldn't assume that the parameters that are listed above are the only parameters that'll be used. Shopify updates functionality often, so new parameters can be introduced. The [Calculate a digital signature](#calculate-a-digital-signature) example demonstrates a maintainable way to handle parameters.

***

## Calculate a digital signature

To verify that the request came from Shopify, you need to compute the HMAC digest according to the SHA-256 hash function and compare it to the value in the `signature` property. If the values match, then the request was sent from Shopify.

The following examples show how to calculate the digital signature when a customer is logged in and the `logged_in_customer_id` parameter is populated, and when no customer is logged in and the `logged_in_customer_id` is empty.

## Ruby file

##### Customer logged in

```ruby
require 'openssl'
require 'rack/utils'
SHARED_SECRET = 'hush'

# Use request.query_string in rails
query_string = "extra=1&extra=2&shop={shop}.myshopify.com&logged_in_customer_id=1&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=4c68c8624d737112c91818c11017d24d334b524cb5c2b8ba08daa056f7395ddb"

query_hash = Rack::Utils.parse_query(query_string)
# => {
#   "extra" => ["1", "2"],
#   "shop" => "{shop}.myshopify.com",
#   "logged_in_customer_id" => 1,
#   "path_prefix" => "/apps/awesome_reviews",
#   "timestamp" => "1317327555",
#   "signature" => "4c68c8624d737112c91818c11017d24d334b524cb5c2b8ba08daa056f7395ddb",
# }

# Remove and save the "signature" entry
signature = query_hash.delete("signature")

sorted_params = query_hash.collect{ |k, v| "#{k}=#{Array(v).join(',')}" }.sort.join
# => "extra=1,2logged_in_customer_id=1path_prefix=/apps/awesome_reviewsshop={shop}.myshopify.comtimestamp=1317327555"

calculated_signature = OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new('sha256'), SHARED_SECRET, sorted_params)
raise 'Invalid signature' unless ActiveSupport::SecurityUtils.secure_compare(signature, calculated_signature)
```

##### Anonymous customer

```ruby
require 'openssl'
require 'rack/utils'
SHARED_SECRET = 'hush'

# Use request.query_string in rails
query_string = "extra=1&extra=2&shop={shop}.myshopify.com&logged_in_customer_id=&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555&signature=e072b6d7e6622d85912a5214b860d3100dc1e73d9bc29f43796ac8c9ff8093cb"

query_hash = Rack::Utils.parse_query(query_string)
# => {
#   "extra" => ["1", "2"],
#   "shop" => "{shop}.myshopify.com",
#   "logged_in_customer_id" => "",
#   "path_prefix" => "/apps/awesome_reviews",
#   "timestamp" => "1317327555",
#   "signature" => "e072b6d7e6622d85912a5214b860d3100dc1e73d9bc29f43796ac8c9ff8093cb",
# }

# Remove and save the "signature" entry
signature = query_hash.delete("signature")

sorted_params = query_hash.collect{ |k, v| "#{k}=#{Array(v).join(',')}" }.sort.join
# => "extra=1,2logged_in_customer_id=path_prefix=/apps/awesome_reviewsshop={shop}.myshopify.comtimestamp=1317327555"

calculated_signature = OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new('sha256'), SHARED_SECRET, sorted_params)
raise 'Invalid signature' unless ActiveSupport::SecurityUtils.secure_compare(signature, calculated_signature)
```

**Caution:**

The signature check only guarantees that the request hasn't been tampered with. The app must also verify that the `logged_in_customer_id` query parameter matches the customer that's associated with the requested data. This ensures that the app returns only data owned by the authenticated user.

***
