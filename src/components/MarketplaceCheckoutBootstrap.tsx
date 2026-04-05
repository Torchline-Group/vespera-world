'use client'

import Script from 'next/script'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type CheckoutProvider = 'snipcart' | 'samcart'

type CheckoutConfig = {
  provider: CheckoutProvider
  snipcartPublicApiKey: string
  samcartCheckoutUrl: string
}

type CheckoutBootstrapProps = {
  children: (config: CheckoutConfig) => ReactNode
}

const DEFAULT_CONFIG: CheckoutConfig = {
  provider: 'snipcart',
  snipcartPublicApiKey: '',
  samcartCheckoutUrl: '',
}

export default function MarketplaceCheckoutBootstrap({ children }: CheckoutBootstrapProps) {
  const [config, setConfig] = useState<CheckoutConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/commerce/checkout', { cache: 'no-store' })
      const payload = (await res.json().catch(() => DEFAULT_CONFIG)) as Partial<CheckoutConfig>
      if (cancelled) return
      setConfig({
        provider: payload.provider === 'samcart' ? 'samcart' : 'snipcart',
        snipcartPublicApiKey: payload.snipcartPublicApiKey ?? '',
        samcartCheckoutUrl: payload.samcartCheckoutUrl ?? '',
      })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const shouldLoadSnipcart = useMemo(
    () => config.provider === 'snipcart' && Boolean(config.snipcartPublicApiKey),
    [config.provider, config.snipcartPublicApiKey],
  )

  return (
    <>
      {shouldLoadSnipcart ? (
        <>
          <link rel="stylesheet" href="https://cdn.snipcart.com/themes/v3.4.1/default/snipcart.css" />
          <Script src="https://cdn.snipcart.com/themes/v3.4.1/default/snipcart.js" strategy="afterInteractive" />
          <div hidden id="snipcart" data-api-key={config.snipcartPublicApiKey} />
        </>
      ) : null}
      {children(config)}
    </>
  )
}
