/**
 * Daily out-of-stock cleanup for the Shopify catalog.
 *
 * Rules, applied once per run (dates in Europe/Bucharest):
 *   1. ACTIVE product with no sellable variant -> tag OUT-OF-STOCK and store
 *      today's date in custom.out_of_stock_since.
 *   2. Still not sellable 7 days after that date -> status HIDE_STATUS, date
 *      stored in custom.out_of_stock_hidden_on. Products are never deleted.
 *   3. Tagged product that is sellable again -> tag and both metafields removed;
 *      if this script hid it, it goes back to ACTIVE.
 *
 * Left alone: ARCHIVED products, drafts the script did not make, products also
 * tagged OUT-OF-STOCK-KEEP (tagged but never hidden), and products someone
 * re-activated by hand after the script hid them (until they are back in stock).
 * "Sellable" is the variant's availableForSale: stock above 0 in any location, or
 * "continue selling when out of stock". The storefront badge only counts the
 * locations that serve the online store, so a unit held only at another location
 * keeps a product out of the script's reach.
 * If more than 70% of active products look unsellable, the stock sync is most
 * likely broken: the run tags and hides nothing and exits with an error.
 *
 * Usage:
 *   node scripts/out-of-stock/out-of-stock.mjs           dry run, prints the plan
 *   node scripts/out-of-stock/out-of-stock.mjs --apply   writes the changes
 *   node scripts/out-of-stock/out-of-stock.mjs --cli     dry run through `shopify store execute` (your CLI login)
 *
 * Auth (not needed with --cli): SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET of a
 * Dev Dashboard app installed on the store (client credentials grant), or
 * SHOPIFY_ACCESS_TOKEN. Scopes: read_products, write_products.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const STORE = process.env.SHOPIFY_STORE || "d8cgqq-8s.myshopify.com";
const API_VERSION = "2026-07";
const TAG = "OUT-OF-STOCK";
const KEEP_TAG = "OUT-OF-STOCK-KEEP";
// DRAFT: the product URL returns 404. UNLISTED: the URL stays live (noindex) but the
// product leaves collections, search, recommendations and the sitemap.
const HIDE_STATUS = "DRAFT";
const HIDE_AFTER_DAYS = 7;
const NAMESPACE = "custom";
const SINCE_KEY = "out_of_stock_since";
const HIDDEN_KEY = "out_of_stock_hidden_on";
const TIME_ZONE = "Europe/Bucharest";
const MAX_OUT_OF_STOCK_SHARE = 0.7;
// A products page below costs up to ~800 points; wait for the bucket instead of getting THROTTLED.
const MIN_AVAILABLE_POINTS = 850;

const COUNT_QUERY = `query ActiveProductsCount {
  productsCount(query: "status:active", limit: null) {
    count
  }
}`;

const PRODUCTS_QUERY = `query OutOfStockProducts($search: String!, $cursor: String, $namespace: String!, $sinceKey: String!, $hiddenKey: String!) {
  products(first: 50, after: $cursor, query: $search) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      handle
      status
      tags
      variantsCount {
        count
      }
      variants(first: 10) {
        nodes {
          availableForSale
        }
      }
      since: metafield(namespace: $namespace, key: $sinceKey) {
        value
      }
      hiddenOn: metafield(namespace: $namespace, key: $hiddenKey) {
        value
      }
    }
  }
}`;

const SET_METAFIELDS = `mutation SetOutOfStockMetafields($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    userErrors {
      field
      message
    }
  }
}`;

const DELETE_METAFIELDS = `mutation DeleteOutOfStockMetafields($metafields: [MetafieldIdentifierInput!]!) {
  metafieldsDelete(metafields: $metafields) {
    userErrors {
      field
      message
    }
  }
}`;

const ADD_TAGS = `mutation AddOutOfStockTag($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    userErrors {
      field
      message
    }
  }
}`;

const REMOVE_TAGS = `mutation RemoveOutOfStockTag($id: ID!, $tags: [String!]!) {
  tagsRemove(id: $id, tags: $tags) {
    userErrors {
      field
      message
    }
  }
}`;

const UPDATE_PRODUCT = `mutation UpdateOutOfStockProduct($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function accessToken() {
  if (process.env.SHOPIFY_ACCESS_TOKEN) return process.env.SHOPIFY_ACCESS_TOKEN;
  const { SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    throw new Error("Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (or SHOPIFY_ACCESS_TOKEN), or run with --cli");
  }
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Access token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function apiClient(token) {
  return async function graphql(query, variables = {}) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`https://${STORE}/admin/api/${API_VERSION}/graphql.json`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-shopify-access-token": token },
        body: JSON.stringify({ query, variables }),
      });
      const body = res.ok ? await res.json() : null;
      const retry = body
        ? body.errors?.some((error) => error.extensions?.code === "THROTTLED")
        : res.status === 429 || res.status >= 500;
      if (retry && attempt < 6) {
        await sleep(2000 * attempt);
        continue;
      }
      if (!body) throw new Error(`Admin API ${res.status}: ${await res.text()}`);
      if (body.errors) throw new Error(`Admin API: ${JSON.stringify(body.errors)}`);
      const bucket = body.extensions?.cost?.throttleStatus;
      if (bucket && bucket.currentlyAvailable < MIN_AVAILABLE_POINTS) {
        await sleep(((MIN_AVAILABLE_POINTS - bucket.currentlyAvailable) / bucket.restoreRate) * 1000);
      }
      return body.data;
    }
  };
}

/** Read-only client for local dry runs, using the Shopify CLI's stored login. */
function cliClient() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "out-of-stock-"));
  const queryFile = path.join(dir, "query.graphql");
  const variablesFile = path.join(dir, "variables.json");
  return async function graphql(query, variables = {}) {
    fs.writeFileSync(queryFile, query);
    fs.writeFileSync(variablesFile, JSON.stringify(variables));
    const command = `shopify store execute -s ${STORE} --json --version ${API_VERSION} --query-file "${queryFile}" --variable-file "${variablesFile}"`;
    const result = spawnSync(command, { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`shopify store execute failed: ${result.stderr || result.stdout}`);
    return JSON.parse(result.stdout);
  };
}

async function fetchProducts(graphql, search) {
  const products = [];
  let cursor = null;
  do {
    const data = await graphql(PRODUCTS_QUERY, {
      search,
      cursor,
      namespace: NAMESPACE,
      sinceKey: SINCE_KEY,
      hiddenKey: HIDDEN_KEY,
    });
    products.push(...data.products.nodes);
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  return products;
}

const matchingTags = (product, tag) => product.tags.filter((t) => t.toLowerCase() === tag.toLowerCase());

/** true or false, or null when the product has more variants than were fetched. */
export function sellable(product) {
  if (product.variantsCount.count > product.variants.nodes.length) return null;
  return product.variants.nodes.some((variant) => variant.availableForSale);
}

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** The action for one product: "restore", "untag", "tag", "hide" or null. */
export function decide(product, today) {
  const isSellable = sellable(product);
  if (product.status === "ARCHIVED" || isSellable === null) return null;
  const tagged = matchingTags(product, TAG).length > 0;
  if (isSellable) {
    if (!tagged) return null;
    return product.hiddenOn && product.status !== "ACTIVE" ? "restore" : "untag";
  }
  if (product.status !== "ACTIVE") return null;
  if (!tagged || !product.since) return "tag";
  // hiddenOn on an ACTIVE product means someone re-activated it by hand.
  if (product.hiddenOn || matchingTags(product, KEEP_TAG).length) return null;
  return daysBetween(product.since.value, today) >= HIDE_AFTER_DAYS ? "hide" : null;
}

async function mutate(graphql, mutation, variables) {
  const data = await graphql(mutation, variables);
  const errors = Object.values(data).flatMap((payload) => payload?.userErrors ?? []);
  if (errors.length) throw new Error(errors.map((error) => error.message).join("; "));
}

const metafieldIds = (product, keys) => keys.map((key) => ({ ownerId: product.id, namespace: NAMESPACE, key }));

const ACTIONS = {
  async restore(graphql, product) {
    await mutate(graphql, UPDATE_PRODUCT, { product: { id: product.id, status: "ACTIVE" } });
    await ACTIONS.untag(graphql, product);
  },
  async untag(graphql, product) {
    await mutate(graphql, REMOVE_TAGS, { id: product.id, tags: matchingTags(product, TAG) });
    await mutate(graphql, DELETE_METAFIELDS, { metafields: metafieldIds(product, [SINCE_KEY, HIDDEN_KEY]) });
  },
  async tag(graphql, product, today) {
    if (product.hiddenOn) await mutate(graphql, DELETE_METAFIELDS, { metafields: metafieldIds(product, [HIDDEN_KEY]) });
    await mutate(graphql, SET_METAFIELDS, {
      metafields: [{ ownerId: product.id, namespace: NAMESPACE, key: SINCE_KEY, type: "date", value: today }],
    });
    await mutate(graphql, ADD_TAGS, { id: product.id, tags: [TAG] });
  },
  async hide(graphql, product, today) {
    await mutate(graphql, UPDATE_PRODUCT, {
      product: {
        id: product.id,
        status: HIDE_STATUS,
        metafields: [{ namespace: NAMESPACE, key: HIDDEN_KEY, type: "date", value: today }],
      },
    });
  },
};

async function main() {
  const args = new Set(process.argv.slice(2));
  const cli = args.has("--cli");
  const apply = args.has("--apply");
  if (cli && apply) throw new Error("--cli only does dry runs; use app credentials to --apply");
  const graphql = cli ? cliClient() : apiClient(await accessToken());
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

  const { productsCount } = await graphql(COUNT_QUERY);
  const products = new Map();
  for (const search of ["status:active AND inventory_total:<=0", `tag:"${TAG}"`]) {
    for (const product of await fetchProducts(graphql, search)) products.set(product.id, product);
  }

  const plan = { restore: [], untag: [], tag: [], hide: [] };
  for (const product of products.values()) {
    const action = decide(product, today);
    if (action) plan[action].push(product);
  }

  const all = [...products.values()];
  const unchecked = all.filter((product) => sellable(product) === null).length;
  if (unchecked) console.warn(`Skipped ${unchecked} products with more than 10 variants`);
  const outOfStock = all.filter((product) => product.status === "ACTIVE" && sellable(product) === false).length;
  const share = outOfStock / productsCount.count;
  const syncLooksBroken = share > MAX_OUT_OF_STOCK_SHARE;
  if (syncLooksBroken) {
    console.error(`${Math.round(share * 100)}% of active products look out of stock; is the stock sync broken? Nothing is tagged or hidden.`);
    plan.tag = [];
    plan.hide = [];
  }

  console.log(`${today} ${apply ? "APPLY" : "DRY RUN"}: ${outOfStock} of ${productsCount.count} active products are out of stock`);
  console.log(Object.entries(plan).map(([action, list]) => `${action}: ${list.length}`).join(", "));

  let failures = 0;
  for (const [action, list] of Object.entries(plan)) {
    for (const product of list) {
      console.log(`${action} ${product.handle}`);
      if (!apply) continue;
      try {
        await ACTIONS[action](graphql, product, today);
      } catch (error) {
        failures++;
        console.error(`  failed: ${error.message}`);
      }
    }
  }
  if (failures) console.error(`${failures} products failed`);
  if (failures || syncLooksBroken) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
