/**
 * Daily collection re-sort: keeps sold-out products at the end of every collection.
 *
 * Replaces the Mechanic task "Move out-of-stock products to the end of a
 * collection", which ran daily against all collections with base sort order
 * MANUAL and "force manual sorting on collections" enabled.
 *
 * Per collection:
 *   1. Read the products in their current collection order.
 *   2. Keep that order, but move every product that cannot be bought to the end.
 *      Both groups keep their relative order, so a manual arrangement survives.
 *   3. Apply the difference with collectionReorderProducts and wait for the job.
 *
 * Reordering only works on a collection whose sort order is MANUAL, so a
 * collection sorted any other way is switched to MANUAL first. This is what the
 * Mechanic option did, and why every collection on this store reads MANUAL.
 * Smart collections that already exclude sold-out products by rule need no moves
 * and cost one read each.
 *
 * "Sellable" is shared with the out-of-stock script: a variant's availableForSale,
 * which counts stock at every location, not only the ones serving the online store.
 * If more than 70% of the catalog looks unsellable the stock sync is most likely
 * broken: nothing is reordered and the run exits with an error.
 *
 * Usage:
 *   node scripts/collection-sort/collection-sort.mjs                      dry run, prints the plan
 *   node scripts/collection-sort/collection-sort.mjs --apply              writes the new order
 *   node scripts/collection-sort/collection-sort.mjs --cli                dry run through `shopify store execute`
 *   node scripts/collection-sort/collection-sort.mjs --collection handle  just one collection (repeatable)
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

import { sellable } from "../out-of-stock/out-of-stock.mjs";

const STORE = process.env.SHOPIFY_STORE || "d8cgqq-8s.myshopify.com";
const API_VERSION = "2026-07";
const TIME_ZONE = "Europe/Bucharest";
const MAX_OUT_OF_STOCK_SHARE = 0.7;
// collectionReorderProducts rejects oversized move lists. Batches are applied in
// ascending target position, so a later batch never disturbs an earlier one.
const MOVES_PER_CALL = 250;
// A collection products page costs up to ~800 points; wait for the bucket
// instead of getting THROTTLED.
const MIN_AVAILABLE_POINTS = 850;
const JOB_POLL_MS = 1000;
const JOB_POLL_ATTEMPTS = 60;

const COLLECTIONS_QUERY = `query SortableCollections($cursor: String) {
  collections(first: 250, after: $cursor) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      handle
      sortOrder
      productsCount {
        count
      }
    }
  }
}`;

const COLLECTION_PRODUCTS_QUERY = `query CollectionProducts($id: ID!, $cursor: String) {
  collection(id: $id) {
    products(first: 250, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        handle
        variantsCount {
          count
        }
        variants(first: 10) {
          nodes {
            availableForSale
          }
        }
      }
    }
  }
}`;

const SET_MANUAL_SORT = `mutation ForceManualSort($input: CollectionInput!) {
  collectionUpdate(input: $input) {
    userErrors {
      field
      message
    }
  }
}`;

const REORDER = `mutation ReorderCollection($id: ID!, $moves: [MoveInput!]!) {
  collectionReorderProducts(id: $id, moves: $moves) {
    job {
      id
      done
    }
    userErrors {
      field
      message
    }
  }
}`;

const JOB_QUERY = `query ReorderJob($id: ID!) {
  job(id: $id) {
    id
    done
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "collection-sort-"));
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

async function fetchCollections(graphql) {
  const collections = [];
  let cursor = null;
  do {
    const data = await graphql(COLLECTIONS_QUERY, { cursor });
    collections.push(...data.collections.nodes);
    cursor = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
  } while (cursor);
  return collections;
}

async function fetchCollectionProducts(graphql, id) {
  const products = [];
  let cursor = null;
  do {
    const data = await graphql(COLLECTION_PRODUCTS_QUERY, { id, cursor });
    const page = data.collection.products;
    products.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return products;
}

/**
 * The moves that turn the current order into "sellable first, sold-out last",
 * both groups keeping their relative order. Positions are simulated the way
 * Shopify applies moves - one at a time, shifting everything else - so the list
 * stays as short as the change actually is. A product whose variants were not
 * all fetched counts as sellable and keeps its place.
 */
export function planMoves(products) {
  const unknown = products.filter((product) => sellable(product) === null).length;
  const isSoldOut = (product) => sellable(product) === false;
  const desired = [...products.filter((product) => !isSoldOut(product)), ...products.filter(isSoldOut)];

  const current = products.map((product) => product.id);
  const moves = [];
  for (const [target, product] of desired.entries()) {
    const at = current.indexOf(product.id);
    if (at === target) continue;
    moves.push({ id: product.id, newPosition: String(target) });
    current.splice(at, 1);
    current.splice(target, 0, product.id);
  }
  return { moves, soldOut: products.filter(isSoldOut).length, unknown };
}

async function awaitJob(graphql, job) {
  for (let attempt = 0; attempt < JOB_POLL_ATTEMPTS; attempt++) {
    if (job.done) return;
    await sleep(JOB_POLL_MS);
    job = (await graphql(JOB_QUERY, { id: job.id })).job;
  }
  throw new Error(`reorder job ${job.id} did not finish in ${JOB_POLL_ATTEMPTS} seconds`);
}

async function mutate(graphql, mutation, variables) {
  const data = await graphql(mutation, variables);
  const errors = Object.values(data).flatMap((payload) => payload?.userErrors ?? []);
  if (errors.length) throw new Error(errors.map((error) => error.message).join("; "));
  return data;
}

async function reorder(graphql, collection, moves) {
  if (collection.sortOrder !== "MANUAL") {
    await mutate(graphql, SET_MANUAL_SORT, { input: { id: collection.id, sortOrder: "MANUAL" } });
  }
  for (let start = 0; start < moves.length; start += MOVES_PER_CALL) {
    const batch = moves.slice(start, start + MOVES_PER_CALL);
    const data = await mutate(graphql, REORDER, { id: collection.id, moves: batch });
    await awaitJob(graphql, data.collectionReorderProducts.job);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const only = new Set(args.filter((arg, index) => args[index - 1] === "--collection"));
  const cli = flags.has("--cli");
  const apply = flags.has("--apply");
  if (cli && apply) throw new Error("--cli only does dry runs; use app credentials to --apply");
  const graphql = cli ? cliClient() : apiClient(await accessToken());
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

  let collections = await fetchCollections(graphql);
  if (only.size) {
    const missing = [...only].filter((handle) => !collections.some((c) => c.handle === handle));
    if (missing.length) throw new Error(`No such collection: ${missing.join(", ")}`);
    collections = collections.filter((collection) => only.has(collection.handle));
  }

  console.log(`${today} ${apply ? "APPLY" : "DRY RUN"}: reading ${collections.length} collections`);

  const plans = [];
  let totalProducts = 0;
  let totalSoldOut = 0;
  let totalUnknown = 0;
  for (const collection of collections) {
    const products = await fetchCollectionProducts(graphql, collection.id);
    const { moves, soldOut, unknown } = planMoves(products);
    totalProducts += products.length;
    totalSoldOut += soldOut;
    totalUnknown += unknown;
    if (moves.length) plans.push({ collection, moves, soldOut, size: products.length });
  }

  if (totalUnknown) console.warn(`Left in place: ${totalUnknown} products with more than 10 variants`);

  const share = totalProducts ? totalSoldOut / totalProducts : 0;
  if (share > MAX_OUT_OF_STOCK_SHARE) {
    console.error(
      `${Math.round(share * 100)}% of collection entries look out of stock; is the stock sync broken? Nothing is reordered.`,
    );
    process.exitCode = 1;
    return;
  }

  const moveCount = plans.reduce((total, plan) => total + plan.moves.length, 0);
  console.log(
    `${totalSoldOut} of ${totalProducts} collection entries are sold out; ` +
      `${plans.length} collections need ${moveCount} moves`,
  );

  let failures = 0;
  for (const { collection, moves, soldOut, size } of plans) {
    console.log(`${collection.handle}: ${moves.length} moves (${soldOut} of ${size} sold out)`);
    if (!apply) continue;
    try {
      await reorder(graphql, collection, moves);
    } catch (error) {
      failures++;
      console.error(`  failed: ${error.message}`);
    }
  }
  if (failures) {
    console.error(`${failures} collections failed`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
