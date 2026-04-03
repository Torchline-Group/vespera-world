import { createClient } from '@/lib/supabase-server'
import MarketplaceCheckoutBootstrap from '@/components/MarketplaceCheckoutBootstrap'
import Image from 'next/image'
import Link from 'next/link'

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)
}

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('handle,title,price,featured_image_url,vendor')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(60)

  return (
    <main className="market-shell">
      <section className="glass-hero">
        <p className="eyebrow">Vespera World</p>
        <h1>Luxury Marketplace</h1>
        <p>Curated products from Vespera creators, partners, and premium collections.</p>
      </section>

      <section className="product-grid">
        <MarketplaceCheckoutBootstrap>
          {(checkout) => (
            <>
              {(products ?? []).length === 0 ? (
                <div className="market-empty">
                  <p style={{ margin: 0 }}>No active products yet.</p>
                  <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                    Sync from Shopify or import CSV under Integrations → Commerce.
                  </p>
                </div>
              ) : null}
              {(products ?? []).map((product) => (
                <article key={product.handle} className="product-card-glass">
                  <Image
                    src={product.featured_image_url || 'https://placehold.co/1200x900?text=Vespera'}
                    alt={product.title}
                    width={600}
                    height={450}
                    className="product-card-thumb"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                  />
                  <div className="product-card-body">
                    <p className="product-vendor">{product.vendor || 'Vespera World'}</p>
                    <h3>{product.title}</h3>
                    <div className="product-row">
                      <span>{formatUsd(Number(product.price ?? 0))}</span>
                      <Link href={`/marketplace/products/${product.handle}`}>Details</Link>
                    </div>
                    <div className="product-card-actions">
                      {checkout.provider === 'snipcart' && checkout.snipcartPublicApiKey ? (
                        <button
                          type="button"
                          className="btn-gold snipcart-add-item"
                          data-item-id={product.handle}
                          data-item-price={Number(product.price ?? 0)}
                          data-item-url={`/marketplace/products/${product.handle}`}
                          data-item-description={product.title}
                          data-item-image={product.featured_image_url || 'https://placehold.co/1200x900?text=Vespera'}
                          data-item-name={product.title}
                        >
                          Add to cart
                        </button>
                      ) : checkout.provider === 'samcart' && checkout.samcartCheckoutUrl ? (
                        <a
                          className="btn-gold"
                          href={`${checkout.samcartCheckoutUrl}${checkout.samcartCheckoutUrl.includes('?') ? '&' : '?'}product=${encodeURIComponent(product.handle)}`}
                        >
                          Buy with SamCart
                        </a>
                      ) : (
                        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                          Configure checkout in Integrations.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </>
          )}
        </MarketplaceCheckoutBootstrap>
      </section>
    </main>
  )
}
