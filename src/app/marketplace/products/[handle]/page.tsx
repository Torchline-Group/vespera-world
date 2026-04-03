import { createClient } from '@/lib/supabase-server'
import MarketplaceCheckoutBootstrap from '@/components/MarketplaceCheckoutBootstrap'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0)
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const supabase = await createClient()

  const { data: product } = await supabase.from('products').select('*').eq('handle', handle).maybeSingle()
  if (!product) return notFound()

  const { data: images } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', product.id)
    .order('position', { ascending: true })

  return (
    <main className="market-shell">
      <Link href="/marketplace" className="link-back">
        ← Back to marketplace
      </Link>
      <section className="product-detail-glass">
        <div className="product-media-stack">
          <Image
            src={product.featured_image_url || images?.[0]?.src || 'https://placehold.co/1200x900?text=Vespera'}
            alt={product.title}
            width={1200}
            height={900}
            className="product-detail-image"
            priority
            sizes="(max-width: 960px) 100vw, 45vw"
          />
        </div>
        <div>
          <p className="product-vendor">{product.vendor || 'Vespera World'}</p>
          <h1>{product.title}</h1>
          <p className="product-price">{formatUsd(Number(product.price ?? 0))}</p>
          <p className="product-description">{product.body_html || 'No description yet.'}</p>
          <MarketplaceCheckoutBootstrap>
            {(checkout) => (
              <div className="product-actions">
                {checkout.provider === 'snipcart' && checkout.snipcartPublicApiKey ? (
                  <>
                    <button
                      type="button"
                      className="btn-gold snipcart-add-item"
                      data-item-id={product.handle}
                      data-item-price={Number(product.price ?? 0)}
                      data-item-url={`/marketplace/products/${product.handle}`}
                      data-item-description={product.title}
                      data-item-image={product.featured_image_url || images?.[0]?.src || 'https://placehold.co/1200x900?text=Vespera'}
                      data-item-name={product.title}
                    >
                      Add to Cart
                    </button>
                    <button type="button" className="btn-ghost snipcart-checkout">
                      Checkout
                    </button>
                  </>
                ) : checkout.provider === 'samcart' && checkout.samcartCheckoutUrl ? (
                  <a
                    className="btn-gold"
                    href={`${checkout.samcartCheckoutUrl}${checkout.samcartCheckoutUrl.includes('?') ? '&' : '?'}product=${encodeURIComponent(product.handle)}`}
                  >
                    Buy with SamCart
                  </a>
                ) : (
                  <p className="muted">Checkout provider not configured.</p>
                )}
              </div>
            )}
          </MarketplaceCheckoutBootstrap>
        </div>
      </section>
    </main>
  )
}
