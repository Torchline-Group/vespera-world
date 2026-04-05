export type CsvImportResult = {
  rows: Array<{
    source: 'csv'
    handle: string
    title: string
    body_html: string
    vendor: string
    product_type: string
    tags: string
    status: 'draft' | 'active' | 'archived'
    price: number
    compare_at_price?: number
    sku?: string
    inventory_qty: number
    featured_image_url?: string
  }>
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current)
  return out
}

export function parseShopifyCsv(csvText: string): CsvImportResult {
  const lines = csvText.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim().length > 0)
  if (lines.length < 2) return { rows: [] }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const idx = (name: string) => headers.indexOf(name.toLowerCase())

  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const get = (name: string) => {
      const i = idx(name)
      return i >= 0 ? (cells[i] ?? '').trim() : ''
    }
    const statusRaw = get('status').toLowerCase()
    return {
      source: 'csv' as const,
      handle: get('handle'),
      title: get('title'),
      body_html: get('body (html)') || get('body_html'),
      vendor: get('vendor'),
      product_type: get('type') || get('product type'),
      tags: get('tags'),
      status: statusRaw.includes('active')
        ? ('active' as const)
        : statusRaw.includes('archive')
          ? ('archived' as const)
          : ('draft' as const),
      price: Number(get('variant price') || get('price') || '0'),
      compare_at_price: Number(get('variant compare at price') || '0') || undefined,
      sku: get('variant sku') || undefined,
      inventory_qty: Number(get('variant inventory qty') || get('inventory') || '0'),
      featured_image_url: get('image src') || undefined,
    }
  })

  return { rows }
}

export function toShopifyCsv(
  products: Array<{
    handle: string
    title: string
    body_html?: string
    vendor?: string
    product_type?: string
    tags?: string
    status?: string
    price?: number
    compare_at_price?: number
    sku?: string
    inventory_qty?: number
    featured_image_url?: string
  }>,
) {
  const headers = [
    'Handle',
    'Title',
    'Body (HTML)',
    'Vendor',
    'Type',
    'Tags',
    'Status',
    'Variant Price',
    'Variant Compare At Price',
    'Variant SKU',
    'Variant Inventory Qty',
    'Image Src',
  ]

  const esc = (value: string | number | undefined) => {
    const s = `${value ?? ''}`
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const lines = [
    headers.join(','),
    ...products.map((p) =>
      [
        esc(p.handle),
        esc(p.title),
        esc(p.body_html),
        esc(p.vendor),
        esc(p.product_type),
        esc(p.tags),
        esc(p.status ?? 'active'),
        esc(p.price ?? 0),
        esc(p.compare_at_price ?? ''),
        esc(p.sku ?? ''),
        esc(p.inventory_qty ?? 0),
        esc(p.featured_image_url ?? ''),
      ].join(','),
    ),
  ]
  return lines.join('\n')
}
