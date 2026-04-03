import { getShopifyEnv } from '@/lib/integration-env'

type ShopifyProductNode = {
  id: string
  handle: string
  title: string
  descriptionHtml: string
  vendor: string
  productType: string
  tags: string[]
  status: string
  featuredImage?: { url: string } | null
  priceRangeV2?: { minVariantPrice?: { amount?: string } } | null
  totalInventory?: number
  createdAt: string
  updatedAt: string
}

export type ShopifySyncProduct = {
  external_id: string
  source: 'shopify'
  handle: string
  title: string
  body_html: string
  vendor: string
  product_type: string
  tags: string
  status: 'draft' | 'active' | 'archived'
  price: number
  inventory_qty: number
  featured_image_url?: string
  created_at: string
  updated_at: string
}

function shopifyStatusToLocal(status: string): 'draft' | 'active' | 'archived' {
  const s = status.toLowerCase()
  if (s.includes('active')) return 'active'
  if (s.includes('archive')) return 'archived'
  return 'draft'
}

export function hasShopifyCredentials() {
  const { storeDomain, adminAccessToken } = getShopifyEnv()
  return Boolean(storeDomain && adminAccessToken)
}

export async function fetchShopifyProducts(limit = 50): Promise<ShopifySyncProduct[]> {
  const { storeDomain, adminAccessToken: token } = getShopifyEnv()
  if (!storeDomain || !token) {
    throw new Error('Missing Shopify credentials. Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN.')
  }

  const endpoint = `https://${storeDomain}/admin/api/2024-10/graphql.json`
  const query = `
    query Products($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            handle
            title
            descriptionHtml
            vendor
            productType
            tags
            status
            featuredImage { url }
            totalInventory
            priceRangeV2 { minVariantPrice { amount } }
            createdAt
            updatedAt
          }
        }
      }
    }
  `

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables: { first: limit } }),
  })

  if (!res.ok) {
    throw new Error(`Shopify request failed: ${res.status}`)
  }

  const payload = (await res.json()) as {
    data?: { products?: { edges?: Array<{ node: ShopifyProductNode }> } }
    errors?: Array<{ message: string }>
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join('; '))
  }

  const nodes = payload.data?.products?.edges?.map((e) => e.node) ?? []
  return nodes.map((node) => ({
    external_id: node.id,
    source: 'shopify',
    handle: node.handle,
    title: node.title,
    body_html: node.descriptionHtml ?? '',
    vendor: node.vendor ?? '',
    product_type: node.productType ?? '',
    tags: (node.tags ?? []).join(','),
    status: shopifyStatusToLocal(node.status ?? ''),
    price: Number(node.priceRangeV2?.minVariantPrice?.amount ?? '0'),
    inventory_qty: Number(node.totalInventory ?? 0),
    featured_image_url: node.featuredImage?.url ?? undefined,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  }))
}
