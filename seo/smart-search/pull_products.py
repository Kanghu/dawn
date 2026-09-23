import json, subprocess, sys, os
# Read-only: pulls every active product with its custom.* metafields and the forma_ metaobject.
# Output: products.json next to this script. Usage: python pull_products.py
S = os.path.dirname(os.path.abspath(__file__))
Q = '''query($cursor: String) {
  products(first: 200, after: $cursor, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title productType totalInventory
      mfs: metafields(first: 80, namespace: "custom") { nodes { key type value } }
      forma: metafield(namespace: "custom", key: "forma_") { references(first: 5) { nodes { ... on Metaobject { handle fields { key value } } } } }
    }
  }
}'''
out = []
cursor = None
while True:
    vars_ = json.dumps({"cursor": cursor})
    open(os.path.join(S, 'q.graphql'), 'w').write(Q)
    r = subprocess.run(['shopify', 'store', 'execute', '--store', 'd8cgqq-8s.myshopify.com', '--query-file', os.path.join(S, 'q.graphql'), '--variables', vars_], capture_output=True, text=True, encoding='utf-8', shell=True)
    raw = r.stdout
    j = json.loads(raw[raw.index('{'):])
    d = j.get('data', j)['products']
    out += d['nodes']
    print(len(out), file=sys.stderr)
    if not d['pageInfo']['hasNextPage']: break
    cursor = d['pageInfo']['endCursor']
json.dump(out, open(os.path.join(S, 'products.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('total', len(out))
